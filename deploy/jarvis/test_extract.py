import io
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path


class ExtractionTests(unittest.TestCase):
    def extract(self, name, link=None):
        with tempfile.TemporaryDirectory(dir=os.environ["WHOOP_TEST_ARTIFACT_DIR"]) as directory:
            root = Path(directory)
            archive = root / "release.tgz"
            destination = root / "release"
            destination.mkdir()
            with tarfile.open(archive, "w:gz") as bundle:
                member = tarfile.TarInfo(name)
                if link:
                    member.type = tarfile.SYMTYPE
                    member.linkname = link
                    bundle.addfile(member)
                else:
                    member.size = 7
                    bundle.addfile(member, io.BytesIO(b"fixture"))
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("extract.py")), str(archive), str(destination)],
                capture_output=True,
            )
            return result.returncode

    def test_accepts_application_file(self):
        self.assertEqual(self.extract("web/public/app.txt"), 0)

    def test_rejects_parent_path(self):
        self.assertNotEqual(self.extract("../runtime.env"), 0)

    def test_rejects_environment_credentials(self):
        self.assertNotEqual(self.extract("web/.env.local"), 0)

    def test_rejects_link_outside_release(self):
        self.assertNotEqual(self.extract("web/link", "../../shared/runtime.env"), 0)


if __name__ == "__main__":
    unittest.main()
