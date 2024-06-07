import json
import os
import tempfile
from pathlib import Path

import jasnah
import jasnah.registry


def main():
    timestamp = jasnah.timestamp()
    assigned_supervisors = os.environ.get("ASSIGNED_SUPERVISORS", None)
    me = jasnah.CONFIG.supervisor_id

    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir)

        with open(path / "info.json", "w") as f:
            json.dump({"me": me, "assigned_supervisors": assigned_supervisors}, f)

        with open(path / "data.txt", "w") as f:
            print("Hello, world!", file=f)

        jasnah.registry.dataset.upload(
            path=path,
            s3_path=f"test/auto_simple_task/{timestamp}",
            author="simple_task.py",
            description="Example dataset generated automatically.",
            name=None,
            details={"timestamp": timestamp},
            show_entry=False,
            tags=['test']
        )


if __name__ == "__main__":
    main()
