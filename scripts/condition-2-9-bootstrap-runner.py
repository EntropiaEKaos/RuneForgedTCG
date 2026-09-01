from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
bootstrap = ROOT / "scripts/condition-2-9-bootstrap.py"
text = bootstrap.read_text()
old = '''replace_once(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual, vida do próprio Nexus',
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus',
)
# Same phrase occurs twice (Unit-source and non-Unit-source copy); patch second occurrence too.
replace_once(
    "src/app/admin/studio/cards/PermanentAuraEditor.tsx",
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual, vida do próprio Nexus',
    'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus',
)
'''
new = '''editor_path = "src/app/admin/studio/cards/PermanentAuraEditor.tsx"
editor_content = read(editor_path)
editor_old = 'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, rodada atual, vida do próprio Nexus'
editor_new = 'quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus'
if editor_content.count(editor_old) != 2:
    raise SystemExit(f"unexpected PermanentAuraEditor copy anchors: {editor_content.count(editor_old)}")
write(editor_path, editor_content.replace(editor_old, editor_new))
'''
if text.count(old) != 1:
    raise SystemExit(f"bootstrap repair anchor count={text.count(old)}")
bootstrap.write_text(text.replace(old, new, 1))
runpy.run_path(str(bootstrap), run_name="__main__")
Path(__file__).unlink(missing_ok=True)
