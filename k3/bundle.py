import re
from pathlib import Path


ROOT = Path(__file__).parent
INDEX_FILE = ROOT / "index.html"
OUTPUT_FILE = ROOT / "K3_bundled.html"


# ============================================================
# Read index.html
# ============================================================

html = INDEX_FILE.read_text(
    encoding="utf-8"
)


# ============================================================
# Match things like:
#
# await loadScript(
#     "scenes/roomScene.js"
# );
#
# or:
#
# await loadScript("helpers.js");
#
# ============================================================

pattern = re.compile(
    r'''
        await
        \s+
        loadScript
        \s*
        \(
        \s*
        ["']
        ([^"']+)
        ["']
        \s*
        \)
        \s*
        ;
    ''',
    re.VERBOSE
)


files_bundled = []


# ============================================================
# Replace each loadScript call with the ACTUAL FILE CONTENTS
# ============================================================

def replace_load_script(match):

    relative_path = match.group(1)

    file_path = ROOT / relative_path

    if not file_path.exists():
        raise FileNotFoundError(
            f"Could not find:\n{file_path}"
        )

    source = file_path.read_text(
        encoding="utf-8"
    )

    files_bundled.append(
        (
            relative_path,
            len(source.encode("utf-8"))
        )
    )

    print(
        f"Bundling: {relative_path}"
    )

    return f"""

        // ====================================================
        // BEGIN BUNDLED FILE: {relative_path}
        // ====================================================

{source}

        // ====================================================
        // END BUNDLED FILE: {relative_path}
        // ====================================================

"""


bundled_html, replacement_count = pattern.subn(
    replace_load_script,
    html
)


# ============================================================
# Make sure we actually found something
# ============================================================

if replacement_count == 0:

    raise RuntimeError(
        "No await loadScript(...) calls were found."
    )


# ============================================================
# Write giant HTML
# ============================================================

OUTPUT_FILE.write_text(
    bundled_html,
    encoding="utf-8"
)


# ============================================================
# Report
# ============================================================

print()
print("=" * 60)

for path, size in files_bundled:

    print(
        f"{path:<40} "
        f"{size / 1024:>8.1f} KB"
    )

print("=" * 60)

output_size = OUTPUT_FILE.stat().st_size

print()
print(
    f"Replaced {replacement_count} loadScript calls."
)

print(
    f"Created: {OUTPUT_FILE.name}"
)

print(
    f"Final size: {output_size / 1024:.1f} KB"
)