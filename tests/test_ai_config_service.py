import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from services.ai_config_service import AiConfigService


class AiConfigServiceTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.service = AiConfigService(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_saves_global_config_without_returning_raw_keys(self):
        saved = self.service.save_config({
            "claude_api_key": "sk-ant-api03-secret1234",
            "claude_model": "claude-sonnet-4-6",
            "openai_api_key": "sk-openai-secret5678",
            "openai_model": "gpt-5.5",
        })

        self.assertTrue(saved["claude"]["hasApiKey"])
        self.assertTrue(saved["openai"]["hasApiKey"])
        self.assertEqual(saved["claude"]["apiKeyMasked"], "sk-ant-...1234")
        self.assertEqual(saved["openai"]["apiKeyMasked"], "sk-open...5678")
        self.assertNotIn("secret", str(saved))

    def test_blank_save_preserves_existing_keys_and_updates_models(self):
        self.service.save_config({
            "claude_api_key": "sk-ant-api03-secret1234",
            "claude_model": "claude-sonnet-4-6",
            "openai_api_key": "sk-openai-secret5678",
            "openai_model": "gpt-5.5",
        })

        self.service.save_config({
            "claude_api_key": "",
            "claude_model": "claude-opus-4-7",
            "openai_api_key": "",
            "openai_model": "gpt-5.4",
        })

        claude = self.service.get_provider_credentials("claude")
        openai = self.service.get_provider_credentials("openai")
        self.assertEqual(claude["apiKey"], "sk-ant-api03-secret1234")
        self.assertEqual(claude["model"], "claude-opus-4-7")
        self.assertEqual(openai["apiKey"], "sk-openai-secret5678")
        self.assertEqual(openai["model"], "gpt-5.4")


if __name__ == "__main__":
    unittest.main()
