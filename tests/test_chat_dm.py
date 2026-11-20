"""Globalny czat i wiadomości prywatne."""
import unittest

from support import BackendTestCase

from app.database import (
    ProfileValidationError,
    create_chat_message,
    create_profile,
    list_chat_messages,
)


class ChatAndDirectMessagesTest(BackendTestCase):
    def test_global_chat_persistence_and_listing(self) -> None:
        """Weryfikuje globalny czat chłopów (tworzenie i pobieranie wiadomości)."""
        initial_messages = list_chat_messages(limit=20)
        self.assertGreaterEqual(len(initial_messages), 2)
        self.assertTrue(any("Siemanko" in m["message"] for m in initial_messages))

        # Dodaj wiadomość od usera
        created = create_chat_message(
            message="Testowa wiadomość z telefonu 📱",
            author_name="Janusz",
        )
        self.assertEqual(created["author_name"], "Janusz")
        self.assertEqual(created["message"], "Testowa wiadomość z telefonu 📱")

        after_messages = list_chat_messages(limit=10)
        self.assertTrue(any(m["id"] == created["id"] for m in after_messages))

        # Test walidacji pustej wiadomości
        with self.assertRaises(ProfileValidationError):
            create_chat_message(message="   ")

    def test_direct_messages_and_chat_history_options(self) -> None:
        """
        Weryfikuje wiadomości prywatne (Direct Messages) między profilami:
        - Wysyłanie 1:1, blokada wysłania do samego siebie
        - Pobieranie wątku konwersacji i automatyczne oznaczanie jako przeczytane
        - Pobieranie listy aktywnych konwersacji (z podglądem ostatniej wiadomości i licznikiem nieprzeczytanych)
        - Opcje historii: wyczyszczenie całej historii konwersacji oraz usunięcie pojedynczej wiadomości
        """
        from fastapi.testclient import TestClient
        from app.main import app

        # Utwórz 2 testowe profile
        p1 = create_profile({
            "name": "Wojtek Nadawca",
            "email": "wojtek.dm@bronet.test",
            "password": "haslo123wojtek",
        })
        p2 = create_profile({
            "name": "Bartek Odbiorca",
            "email": "bartek.dm@bronet.test",
            "password": "haslo123bartek",
        })
        c1 = TestClient(app)
        c2 = TestClient(app)
        c1.post("/api/profiles/login", json={"email": "wojtek.dm@bronet.test", "password": "haslo123wojtek"})
        c2.post("/api/profiles/login", json={"email": "bartek.dm@bronet.test", "password": "haslo123bartek"})

        # Bez sesji: brak dostępu, a podanie cudzego profile_id nic nie daje
        anon = TestClient(app)
        self.assertEqual(anon.get(f"/api/dm/conversations?profile_id={p1['id']}").status_code, 401)
        self.assertEqual(
            anon.post(f"/api/dm/messages/{p2['id']}", json={"message": "podszywka", "profile_id": p1["id"]}).status_code,
            401,
        )

        # 1. Próba wysłania wiadomości do samego siebie -> 422
        res_self = c1.post(
            f"/api/dm/messages/{p1['id']}",
            json={"message": "Hej do lustra"},
        )
        self.assertEqual(res_self.status_code, 422)

        # 2. Wysyłanie DM z p1 do p2
        res_send = c1.post(
            f"/api/dm/messages/{p2['id']}",
            json={"message": "Cześć Bartek, potrzebujesz pomocy z spawaniem?"},
        )
        self.assertEqual(res_send.status_code, 201)
        msg_data = res_send.json()
        self.assertEqual(msg_data["sender_id"], p1["id"])
        self.assertEqual(msg_data["receiver_id"], p2["id"])
        self.assertFalse(msg_data["is_read"])
        msg1_id = msg_data["id"]

        # 3. Sprawdzenie licznika nieprzeczytanych dla p2
        unread_res = c2.get(f"/api/dm/unread-count")
        self.assertEqual(unread_res.status_code, 200)
        self.assertEqual(unread_res.json()["unread_count"], 1)

        # 4. Lista konwersacji dla p2 (Messenger/LinkedIn inbox)
        convs_res = c2.get(f"/api/dm/conversations")
        self.assertEqual(convs_res.status_code, 200)
        convs = convs_res.json()
        self.assertEqual(len(convs), 1)
        self.assertEqual(convs[0]["partner_id"], p1["id"])
        self.assertEqual(convs[0]["partner_name"], "Wojtek Nadawca")
        self.assertEqual(convs[0]["unread_count"], 1)
        self.assertIn("spawaniem", convs[0]["last_message"])

        # 5. Odczyt wiadomości przez p2 (mark_read=True domyślnie)
        thread_res = c2.get(f"/api/dm/messages/{p1['id']}")
        self.assertEqual(thread_res.status_code, 200)
        thread = thread_res.json()
        self.assertEqual(len(thread), 1)
        self.assertEqual(thread[0]["id"], msg1_id)

        # Licznik nieprzeczytanych p2 po odczycie -> 0
        unread_res_after = c2.get(f"/api/dm/unread-count")
        self.assertEqual(unread_res_after.json()["unread_count"], 0)

        # 6. Odpowiedź od p2 do p1
        res_reply = c2.post(
            f"/api/dm/messages/{p1['id']}",
            json={"message": "Jasne, chętnie! Kiedy masz czas?"},
        )
        self.assertEqual(res_reply.status_code, 201)
        msg2_id = res_reply.json()["id"]

        # Wątek p1 ma teraz 2 wiadomości
        thread_p1 = c1.get(f"/api/dm/messages/{p2['id']}")
        self.assertEqual(len(thread_p1.json()), 2)

        # 7. Usunięcie pojedynczej wiadomości przez p1
        del_single = c1.delete(f"/api/dm/messages/{msg1_id}")
        self.assertEqual(del_single.status_code, 200)

        # Wątek p1 ma teraz 1 wiadomość (druga została ukryta dla p1)
        thread_p1_after = c1.get(f"/api/dm/messages/{p2['id']}")
        self.assertEqual(len(thread_p1_after.json()), 1)
        self.assertEqual(thread_p1_after.json()[0]["id"], msg2_id)

        # Dla p2 wiadomość msg1 nadal istnieje (chyba że p2 też ją usunie)
        thread_p2_after = c2.get(f"/api/dm/messages/{p1['id']}")
        self.assertEqual(len(thread_p2_after.json()), 2)

        # 8. Wyczyść całą historię konwersacji z p1 dla p2
        clear_res = c2.delete(f"/api/dm/conversations/{p1['id']}")
        self.assertEqual(clear_res.status_code, 200)

        # Teraz p2 ma pusty wątek z p1
        thread_p2_cleared = c2.get(f"/api/dm/messages/{p1['id']}")
        self.assertEqual(len(thread_p2_cleared.json()), 0)


if __name__ == "__main__":
    unittest.main()
