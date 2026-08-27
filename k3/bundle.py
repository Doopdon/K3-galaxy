import re
import json
from pathlib import Path


ROOT = Path(__file__).parent
INDEX_FILE = ROOT / "index.html"
OUTPUT_FILE = ROOT / "K3_bundled.html"


# --------------------------------------------
# Read index.html
# --------------------------------------------

html = INDEX_FILE.read_text(encoding="utf-8")


# --------------------------------------------
# Find every:
#
# await loadScript(
#     "whatever/file.js"
# );
#
# --------------------------------------------

pattern = r'loadScript\s*\(\s*["\']([^"\']+)["\']\s*\)'

references = re.findall(pattern, html)

# Remove duplicates while keeping order
references = list(dict.fromkeys(references))


print("Found JS files:")

sources = {}

for reference in references:

    path = ROOT / reference

    if not path.exists():
        raise FileNotFoundError(
            f"Could not find referenced file:\n{path}"
        )

    print("  ", reference)

    source = path.read_text(
        encoding="utf-8"
    )

    sources[reference] = source


# --------------------------------------------
# Turn all JS source into a JavaScript object
#
# JSON encoding handles quotes/newlines/etc.
# --------------------------------------------

source_json = json.dumps(
    sources,
    ensure_ascii=False
)

# Important:
# Prevent embedded source from accidentally
# closing the outer <script> element.
source_json = source_json.replace(
    "</script",
    "<\\/script"
)


bundle_code = f"""
        // ========================================
        // BUNDLED LOCAL JAVASCRIPT
        // Generated automatically by bundle.py
        // ========================================

        window.__BUNDLED_SCRIPTS__ = {source_json};

"""


# --------------------------------------------
# Insert bundled files immediately before
# function loadScript(...)
# --------------------------------------------

marker = "        function loadScript(path) {"

if marker not in html:
    raise RuntimeError(
        "Could not find function loadScript(path) in index.html"
    )

html = html.replace(
    marker,
    bundle_code + marker,
    1
)


# --------------------------------------------
# Replace the original loadScript implementation
#
# Instead of requesting a .js file, it creates
# a classic inline script from bundled source.
#
# This is important because your files currently
# behave as ordinary scripts, not ES modules.
# --------------------------------------------

old_function_pattern = re.compile(
    r'''
        function\s+loadScript\s*\(\s*path\s*\)\s*\{
        .*?
        \n        \}
    ''',
    re.DOTALL | re.VERBOSE
)


new_function = """function loadScript(path) {

            return new Promise((resolve, reject) => {

                const source =
                    window.__BUNDLED_SCRIPTS__[path];

                if (source === undefined) {

                    reject(
                        new Error(
                            "Bundled script not found: " +
                            path
                        )
                    );

                    return;
                }


                try {

                    const script =
                        document.createElement("script");

                    // Using textContent means this executes
                    // as a NORMAL classic JavaScript script.
                    //
                    // Therefore globals behave exactly like
                    // your current dynamically-loaded files.
                    script.textContent =
                        source +
                        "\\n//# sourceURL=" +
                        path;

                    document.body.appendChild(
                        script
                    );

                    resolve();

                }
                catch (error) {

                    reject(error);
                }
            });
        }"""


html, count = old_function_pattern.subn(
    new_function,
    html,
    count=1
)

if count != 1:
    raise RuntimeError(
        "Could not replace loadScript()"
    )


# --------------------------------------------
# Write final standalone-ish HTML
# --------------------------------------------

OUTPUT_FILE.write_text(
    html,
    encoding="utf-8"
)


print()
print("Done!")
print(f"Created: {OUTPUT_FILE.name}")
print()
print(
    "All local JS files are now embedded "
    "inside the HTML."
)