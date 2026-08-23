#!/usr/bin/env python3
"""
v26.410: leesbaarheid -- alle kleine tekst omhoog.

Rob: "kan ALLE kleine tekst zoals Asian lines iets duidelijker misschien groter lettertype?"

Aanpak: EEN monotone, stuksgewijs-lineaire schaal i.p.v. losse aanpassingen, zodat de
onderlinge hierarchie exact behouden blijft (kleiner blijft kleiner, gelijk blijft gelijk).
Zonder zo'n schaal loop je bij een handmatige ronde gegarandeerd tegen inversies aan:
bv. .64 naar .77 tillen terwijl .66 blijft staan draait de verhouding om.

Mapping: [0.36 .. 0.80] -> [0.50 .. 0.80] lineair; alles >= 0.80 blijft ongemoeid.
Effect: de kleinste tekst (.36/.42/.44rem, praktisch onleesbaar op een telefoon) gaat naar
.50-.56rem; middenklasse .5 -> .60; en hoe dichter bij .80, hoe kleiner de verandering --
zo groeit de layout niet uit zijn voegen.
"""
import re, sys

LO_IN, HI_IN = 0.36, 0.80
LO_OUT, HI_OUT = 0.50, 0.80

def scale(v: float) -> float:
    if v >= HI_IN:
        return v
    if v <= LO_IN:
        return LO_OUT
    return LO_OUT + (v - LO_IN) * (HI_OUT - LO_OUT) / (HI_IN - LO_IN)

def fmt(v: float) -> str:
    s = f"{v:.2f}"
    if s.startswith("0."):
        s = s[1:]
    if s.endswith("0") and len(s) > 3:
        s = s[:-1]
    return s

PAT = re.compile(r"(font-size:\s*)(0?\.\d+)rem")

def process(path: str) -> int:
    src = open(path, encoding="utf-8").read()
    changes = [0]

    def repl(m):
        old = float(m.group(2))
        new = scale(old)
        if abs(new - old) < 0.005:
            return m.group(0)
        changes[0] += 1
        return f"{m.group(1)}{fmt(new)}rem"

    out = PAT.sub(repl, src)
    if changes[0]:
        open(path, "w", encoding="utf-8").write(out)
    return changes[0]

if __name__ == "__main__":
    total = 0
    for p in sys.argv[1:]:
        n = process(p)
        total += n
        print(f"  {p}: {n} aangepast")
    print(f"TOTAAL: {total}")
