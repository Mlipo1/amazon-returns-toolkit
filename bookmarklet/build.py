"""Wraps source.js into a javascript: bookmarklet and writes install.html."""
import re, html, urllib.parse, pathlib

here = pathlib.Path(__file__).parent
src = (here / "source.js").read_text(encoding="utf-8")

# Collapse leading indentation and blank lines. No // comments exist in source.js,
# so newlines survive encoding safely -- keep them rather than risk a bad minify.
lines = [ln.strip() for ln in src.splitlines()]
code = "\n".join(ln for ln in lines if ln)

bookmarklet = "javascript:" + urllib.parse.quote(code, safe="!'()*-._~")

page = """<!doctype html>
<meta charset="utf-8">
<title>Install: Amazon Return Codes</title>
<style>
body{font:15px/1.6 system-ui,Segoe UI,sans-serif;max-width:720px;margin:0 auto;padding:40px 24px;color:#111}
h1{font-size:24px;margin:0 0 6px}
.sub{color:#666;margin:0 0 28px}
.drag{display:inline-block;background:#ffd814;border:1px solid #fcd200;border-radius:8px;
      padding:14px 26px;font-weight:700;text-decoration:none;color:#111;font-size:16px;
      box-shadow:0 2px 5px rgba(0,0,0,.15);cursor:grab}
.box{background:#f6f6f6;border:1px solid #ddd;border-radius:10px;padding:22px;margin:24px 0}
ol{padding-left:20px}li{margin:8px 0}
code{background:#eee;padding:2px 6px;border-radius:4px;font-size:13px}
.note{color:#555;font-size:13px;border-left:3px solid #ddd;padding-left:14px;margin:18px 0}
#hint{display:none;background:#fff4e5;border:1px solid #ffd8a8;border-radius:8px;
      padding:12px 16px;margin-top:16px;color:#7a4b00;font-size:14px}
</style>

<h1>Amazon Return Codes</h1>
<p class=sub>One click &rarr; every active return, its QR image, emailed to you.</p>

<div class=box>
  <p style="margin-top:0"><b>Drag this button up to your bookmarks bar</b>
     &mdash; don't click it here:</p>
  <p><a class=drag id=bm href="__BOOKMARKLET__">&#128230; My Return Codes</a></p>
  <p style="margin-bottom:0;color:#666;font-size:13px">
    Bookmarks bar hidden? Press <code>Ctrl</code>+<code>Shift</code>+<code>B</code> first.
  </p>
  <div id=hint>
    <b>Drag it, don't click it.</b> Clicking here runs it on this local file, which has no
    access to your Amazon session. Drag the button up to the bookmarks bar, open
    <code>amazon.com</code>, and click it from there.
  </div>
</div>
<script>
document.getElementById("bm").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("hint").style.display = "block";
});
</script>

<h2 style="font-size:17px">Using it</h2>
<ol>
  <li>Be signed in to Amazon, on any <code>amazon.com</code> page.</li>
  <li>Click <b>&#128230; My Return Codes</b> in your bookmarks bar.</li>
  <li>A tab opens and counts through your returns (a few seconds).</li>
  <li>First run only: it asks for your email address and remembers it.</li>
  <li>You get a page with every item, its picture and its scannable QR. Click
      <b>Email to&nbsp;you</b> &mdash; it copies everything and opens Gmail.</li>
  <li>Click in the Gmail message body, press <code>Ctrl</code>+<code>V</code>, then Send.</li>
</ol>

<div class=note>
It only reads. It never cancels, edits, or submits anything on your account.
The email opens as a Gmail draft &mdash; nothing sends until you press Send yourself.
</div>

<h2 style="font-size:17px">If it stops working</h2>
<p>Amazon changes their page markup every so often. The two things that can break are the
card selector <code>.item-return-history-card</code> and the QR match
<code>qrcode-images</code>, both in <code>source.js</code>. Re-run
<code>python build.py</code> after editing to regenerate this page.</p>
"""

page = page.replace("__BOOKMARKLET__", html.escape(bookmarklet, quote=True))
(here / "install.html").write_text(page, encoding="utf-8")

print("code chars      :", len(code))
print("bookmarklet len :", len(bookmarklet))
print("wrote           :", here / "install.html")
