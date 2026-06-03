import unittest
from unittest.mock import MagicMock, patch

from config import AZDO_API_VERSION
from services.devops_client import AzureDevOpsClient


class DownloadNamedArtifactTest(unittest.TestCase):
    def setUp(self):
        self.client = AzureDevOpsClient(pat="x", organization="lp", project="TA")

    @patch("services.devops_client.requests.get")
    def test_returns_zip_bytes_on_success(self, mock_get):
        response = MagicMock(status_code=200, content=b"PK\x03\x04zip")
        mock_get.return_value = response

        result = self.client.download_named_artifact(812, "Autofix Report")

        self.assertEqual(result, b"PK\x03\x04zip")
        called_url = mock_get.call_args[0][0]
        self.assertIn("build/builds/812/artifacts", called_url)
        params = mock_get.call_args.kwargs["params"]
        self.assertEqual(params["artifactName"], "Autofix Report")
        self.assertEqual(params["$format"], "zip")
        self.assertEqual(params["api-version"], AZDO_API_VERSION)
        self.assertIn("Authorization", mock_get.call_args.kwargs["headers"])

    @patch("services.devops_client.requests.get")
    def test_returns_none_when_artifact_missing(self, mock_get):
        response = MagicMock(status_code=404)
        mock_get.return_value = response

        result = self.client.download_named_artifact(812, "Autofix Report")

        self.assertIsNone(result)
        # The 404 guard must short-circuit before raise_for_status.
        response.raise_for_status.assert_not_called()


if __name__ == "__main__":
    unittest.main()
