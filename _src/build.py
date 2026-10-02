"""_src/sim.js + _src/app.js(게임 로직)와 _src/app.css(추가 스타일)를 ../index.html에 다시 합칩니다.

사용법:  python build.py
index.html 안의 React 런타임은 그대로 두고, 표시(APP_START/APP_END, APP_CSS) 사이만 교체합니다.
"""
import pathlib

here = pathlib.Path(__file__).resolve().parent
html_path = here.parent / "index.html"
html = html_path.read_text(encoding="utf-8")
# sim.js(타구·수비 계산)를 먼저 넣고 app.js(화면·진행)가 그것을 사용
app = (here / "sim.js").read_text(encoding="utf-8") + "\n" + (here / "app.js").read_text(encoding="utf-8")
css = (here / "app.css").read_text(encoding="utf-8")

JS_START, JS_END = "/*APP_START*/", "/*APP_END*/"
if JS_START in html:
    i = html.index(JS_START)
    j = html.index(JS_END) + len(JS_END)
else:  # 최초 빌드: 원본 번들의 앱 영역(_=c(u(),1),v={0: ... </script>)을 표시로 감쌈
    i = html.index("_=c(u(),1),v={0:") + len("_=c(u(),1)")
    j = html.index("</script>", i)
    html = html[:i] + ";" + html[i + 1:]  # 원래 콤마로 이어지던 선언을 끝냄
    i += 1
html = html[:i] + JS_START + "\n" + app + "\n" + JS_END + html[j:]

CSS_START, CSS_END = "/*APP_CSS_START*/", "/*APP_CSS_END*/"
if CSS_START in html:
    i = html.index(CSS_START)
    j = html.index(CSS_END) + len(CSS_END)
else:
    i = j = html.index("/*$vite$:1*/")
html = html[:i] + CSS_START + "\n" + css + "\n" + CSS_END + html[j:]

html_path.write_text(html, encoding="utf-8", newline="")
print("built", html_path, len(html), "bytes")
