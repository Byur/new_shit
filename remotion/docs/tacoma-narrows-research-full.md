# FACT PACK — Tacoma Narrows Bridge (1940), "Galloping Gertie"
### For a Chinese-language science explainer video
**Thesis supported:** why does a bridge that looks solid suddenly twist in the wind and collapse — the relationship between airflow, structural motion, and aeroelastic instability.

**How to read this pack.** Every non-obvious claim has a source link. Numbers are quoted as the source gives them, with conversions. Sources that disagree are shown side by side — do not average them silently. Section 7 lists every "commonly repeated but dubious" claim and every gap I could not verify.

**Verification tier labels used below:**
- ✅ **PRIMARY** — 1941 inquiry report, Farquharson's own measurements, peer-reviewed literature, official agency page.
- 🟡 **RELIABLE SECONDARY** — Wikipedia (sourced), ASCE, WSDOT, major news.
- 🔴 **POPULAR/UNVERIFIED** — widely repeated, single weak source, or my own arithmetic. Use with caution or attribute on screen.

---

## 0. Quick-reference fact table

| Fact | Value | Confidence |
|---|---|---|
| Main span | **2,800 ft / 853.4 m** (853.44 m in modern CFD) | ✅ |
| Total length | **5,939 ft / 1,810.2 m** | 🟡 |
| Side spans | **1,100 ft each** | ✅ |
| Deck width between cables | **39 ft / 12 m** | ✅ |
| Roadway width | **26 ft**, plus two **5-ft sidewalks** (WSDOT) | ✅ |
| Deck width (HAER variant) | **36 ft** | 🟡 (HAER conflicts with WSDOT) |
| Stiffening girder depth | **8 ft / 2.4 m solid plate girder** (96-inch web) | ✅ |
| Span ÷ girder depth | **350 : 1** (American Heritage/HAER) or **375 : 1** (STRUCTURE) | 🟡 |
| Width ÷ span | **1 : 72** (Ammann) / **1 : 75** (STRUCTURE) / **1 : 78** (HAER) | ✅ |
| Deck dead load | **5,700 lb per linear foot** (vs GWB 31,590 lb/ft) | 🟡 |
| Lanes | **2** | ✅ |
| Clearance below | **195 ft / 59.4 m** | ✅ |
| Tower height (WSDOT) | **443 ft above water / 425 ft above piers / 230 ft above roadway**; each tower weighs **1,927 tons**. 1950 towers: **500 ft above water / 467 ft above piers** | ✅ |
| Tower height (EBSCO variant) | **436 ft above water** — a near-miss variant of WSDOT's **443 ft above water**; the two are estimates of the same quantity | 🟡 |
| Construction start | **23 Nov 1938** (lead says "September 1938" — internal conflict) | 🟡 |
| Opened | **1 July 1940** | ✅ |
| Collapsed | **7 Nov 1940**, main span gone by **~11:10 a.m. PST** | ✅ |
| Service life | **129 days** ("four months") | ✅ (my arithmetic) |
| Construction cost | **$6.4 million** (PWA grant ≈$6 M + RFC loan + $1.6 M tolls) | ✅ |
| Wind at collapse | **40–45 mph** that morning; **42 mph = 67.6 km/h = 18.8 m/s** (Farquharson); **~18 m/s** (modern CFD) | ✅ |
| Heave (vertical) frequency pre-collapse | **36–38 cycles/min ≈ 0.6 Hz**, 8–9 half-waves, ~3 ft double amplitude | ✅ |
| Torsional frequency at failure | **12 cycles/min = 0.20 Hz, period 5 s** | ✅ |
| Twist amplitude | **±35°** (Farquharson); **~45°** at quarter points (STRUCTURE/EBSCO); **≈40°** (Green & Unruh). Never say 28° or 38° | ✅ |
| Mode ratio (torsion ÷ vertical) | **10.0 / 8.0 = 1.25** (vs 1.9 GGB & Verrazano, 3.9 Severn) | ✅ |
| Critical flutter speed | **~35 mph / 56 km/h** (dimensional, disputed); **U_c/(f·B) = 3.56–4** (dimensionless, robust) | ✅ |
| Human deaths | **0** — only fatality was the dog **Tubby** | ✅ |
| Replacement opened | **14 Oct 1950**, "Sturdy Gertie" | ✅ |

---

## 1. Timeline of the bridge

### 1.1 Design and construction

| Date | Event | Source |
|---|---|---|
| 1889 | Northern Pacific Railway proposes a trestle across the Narrows — earliest recorded proposal | [Wikipedia, TNB (1940)](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing Petroski, *American Scientist* 97(2) |
| 1923 | Tacoma Chamber of Commerce begins campaigning and funding studies | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| 1929 | **David B. Steinman** presents a preliminary proposal (Chamber-funded). Agreement cancelled 1931 | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| 1937 | Washington State legislature creates the **Washington State Toll Bridge Authority**; appropriates **$5,000** to study the project. (American Heritage says **$25,000** — sources disagree.) | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [American Heritage](https://www.americanheritage.com/content/tacoma-narrows-bridge-falling-down) |
| 1938, **23 June** | Federal **Public Works Administration (PWA)** approves nearly **$6 million** for the bridge | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| 1938 | **Steinman**, at the ASCE structural division meeting, predicts the bridge's failure — with its designer in the audience | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing Scott, *In the Wake of Tacoma* (2001) |
| 1938, **23 Nov** | Construction begins on Moisseiff's design | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [AAPT teacher's guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| 1940, **2 Nov** | Farquharson's first wind-tunnel studies conclude — **five days before collapse** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| 1940, **early Nov** | Deflector-vane retrofit approved by the Toll Bridge Authority; never installed | [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) |
| 1940, **1 July** | Bridge opens to traffic | ✅ |
| 1940, **7 Nov** | Main span collapses | ✅ |

**⚠️ Conflict on construction start.** The Wikipedia **lead** says "Construction began in September 1938"; the Wikipedia **infobox and body**, and the AAPT teacher's guide, both say **November 23, 1938** (the body cites a contemporaneous *Bremerton Daily News Searchlight* page). **Use 23 November 1938.** Construction took **19 months** ([EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses); [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940))).

### 1.2 Who designed what — get this exactly right

This is the single most commonly garbled part of the story. There are **three** distinct design roles plus a theorist:

**① Clark Eldridge (1896–1990) — the ORIGINAL design (rejected).**
Washington State's own engineer. He produced "a preliminary tried-and-true conventional suspension bridge design." The Washington Department of Highways plans "had called for a set of **25-foot-deep (7.6 m) trusses** to sit beneath the roadway and stiffen it." Cost estimate: **$11 million**. EBSCO calls him "the bridge's original designer and chief engineer." He "accepted some of the blame for the bridge's failure" and was later a POW in Japan, where a captor recognised him and said *"Tacoma Bridge!"* ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses); [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/))

**② Leon Moisseiff (1872–1943) — the ADOPTED, AS-BUILT design.**
The New York consulting engineer (also designer/consultant engineer for the **Golden Gate Bridge**). He petitioned the PWA and the Reconstruction Finance Corporation (RFC) to build the bridge for less, arguing with his new **elastic distribution theory** that the cables would absorb up to half the static wind pressure. He won: the bridge was built with **8-ft plate girders** instead of 25-ft trusses. **Moisseiff is the designer of the bridge that collapsed.** Born Riga 10 Nov 1872; died 3 Sep 1943. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [Wikipedia, Leon Moisseiff](https://en.wikipedia.org/wiki/Leon_Moisseiff))

**③ Frederick Lienhard — a THEORIST, not the designer.**
An engineer with the Port Authority of New York and New Jersey. He and Moisseiff co-authored *"Suspension Bridges Under the Action of Lateral Forces,"* **Transactions of the ASCE, No. 98, 1933, pp. 1080–1095, 1096–1141** — "probably the most important theoretical advance in the bridge engineering field of the decade." Their theory extended **Josef Melan's** deflection theory to horizontal bending under static wind load. **Lienhard did not design the Tacoma bridge; he co-authored the theory that Moisseiff used to justify the shallow girders.** ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing Scott 2001)

**④ Frederick Burt Farquharson — the FIXER, not the designer.**
University of Washington engineering professor. The Washington State Toll Bridge Authority hired him to run wind-tunnel tests and recommend fixes **after** the oscillations appeared. He built a **1:200-scale full-bridge model** and a **1:20-scale section model**. His first studies concluded **2 Nov 1940**. He proposed (a) drilling holes in the lateral girders and deck to let air through, or (b) adding fairings/deflector vanes. Option (b) was chosen but never carried out. ⚠️ **The Wikipedia "Tacoma Narrows Bridge" (main) article says Farquharson "had been involved in the design of the bridge" — that is loose and misleading. He was retained as a consulting engineer to solve a problem the design had created.** ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [Wikipedia, main TNB](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge))

**⑤ Others worth naming:** **Joseph B. Strauss** (consulted early; later chief engineer of the Golden Gate Bridge) and **David B. Steinman** (consulted 1929; later designer of the Mackinac Bridge; predicted the failure). The 1941 Federal Works Agency inquiry board was **Othmar Ammann, Theodore von Kármán, and Glenn B. Woodruff**. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

### 1.3 Cost figures

| Figure | Amount | Source |
|---|---|---|
| Toll Bridge Authority's original federal request | **$11 million** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| PWA approval, 23 June 1938 | **nearly $6 million** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| From tolls | **$1.6 million** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Estimated total at the time | **$8 million** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| **Final construction cost** | **$6.4 million** (PWA grant + RFC loan) | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) |
| Insurance settlement | Primary record: **"$4,000,000 plus salvage"** plus **$240,000** Use & Occupancy. The widely quoted **"$5.2 million / 80% of value"** is **unverified** and in tension with the primary accounting. | 🟡 [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) vs WTBA *Final Report* (1952) |
| Compensation to Leonard Coatsworth | **$814.40 total** ($450.00 car + $364.40 contents — **including Tubby**) | ✅ [WSDOT "Weird Facts"](https://wsdot.wa.gov/TNBfacts/weird-facts.htm) via [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |

**Note on the "no payout" anecdote:** Wikipedia records that the insurance agent who wrote an $800,000 policy pocketed the $70,000 premium instead of forwarding it and went to jail for two years. **Single-source, popular-history register — verify before using.** ([American Heritage](https://www.americanheritage.com/content/tacoma-narrows-bridge-falling-down))

### 1.4 The "Galloping Gertie" nickname

- **Who — WSDOT's primary account, verbatim (Weird Fact #5):** "In early May 1940, when workers were building forms and laying concrete for the roadway, the Narrows Bridge began its soon-famous ripple. **It was probably one of the 'boomers' who dubbed the bouncing span, 'Galloping Gertie.'** Local residents picked up the nickname and it stuck." WSDOT's chronology adds, for May 1940: "riveters and other workmen notice the 'bounce,' or 'galloping' of the bridge. **Some chew on lemons to combat nausea.**" ([WSDOT Weird Facts](https://www.wsdot.wa.gov/TNBHistory/weird-facts.htm)) ✅ — **This is the single best-sourced version: the nickname dates from early May 1940, coined by a construction worker ("boomer"), not by the public.**
- **Who — Wikipedia/AAPT wording:** Wikipedia: "From the time the deck was built, it began to move vertically in windy conditions, so construction workers nicknamed the bridge '**Galloping Gertie**.'" AAPT: "the bridge was christened 'Galloping Gertie' by the people of the Tacoma area." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))
- **Why:** the **vertical** undulating motion — "a mild to moderate wind could cause alternate halves of the centre span to visibly rise and fall **several feet over four- to five-second intervals**." Drivers reported "seeing oncoming cars appear and disappear because of the wave-like motion." EBSCO: "humps and valleys like the body of a sea serpent"; cars in different valleys lost sight of each other. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [American Heritage](https://www.americanheritage.com/content/tacoma-narrows-bridge-falling-down); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses))
- **Also applied elsewhere:** WSDOT confirms the name had **first been used for the Wheeling Bridge** in West Virginia; EBSCO dates the Wheeling collapse to **17 May 1854** and notes the Golden Gate was nicknamed "G.G." and also bounced. Useful for a script line about this being a known failure family. 🟡
- The motion was felt by the public on **opening day, 1 July 1940** ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940))).

---

## 2. Key dimensions, and the slenderness that killed it

### 2.1 Exact numbers

| Dimension | Value | Source |
|---|---|---|
| Total length | **5,939 ft / 1,810.2 m** | [Wikipedia infobox](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Main span (tower to tower) | **2,800 ft / 850 m / 853.4 m** (853.44 m in [Song et al. 2022](https://doi.org/10.1017/jfm.2022.748)) | ✅ |
| Side spans | **1,100 ft each** | [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) |
| Tower height | **443 ft above water / 425 ft above piers / 230 ft above roadway**; each tower weighs **1,927 tons** ([WSDOT Span Stats](https://www.wsdot.wa.gov/TNBhistory/1940-bridge.htm)). WSDOT prose: Moisseiff "changed the towers to the same height, **425 feet**" (Eldridge's original called for west 463 ft 6 in, east 476 ft 6 in). **EBSCO's "436 ft above the water" is a variant of the 443-ft figure — same quantity, different estimate.** **Watch the datum: 425 ft is above the piers, not above the water.** | ✅ |
| Tower pedestals | each the size of a 20-storey building: **130 × 80 × 225 ft** | [1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)) |
| Deck width | **39 ft / 12 m between cables** (WSDOT: "Width between Cables 39 feet"; AAPT: "width between cables, center-to-center, was 39 feet"; STRUCTURE: girders "spaced 39 feet on-center"). **Roadway itself 26 ft** wide, plus **two 5-ft sidewalks** ([WSDOT Span Stats](https://www.wsdot.wa.gov/TNBhistory/1940-bridge.htm)). Modern CFD uses **B = 12 m**. **HAER's "36 ft" is a third figure — flag it.** | ✅ |
| Stiffening girder depth | **8 ft / 2.4 m** — solid plate girders built up with a **96-inch × ½-inch web**, four 8×6×½-inch angles, two 20×½-inch cover plates. AAPT: "Height of side girders: **8 feet**." | ✅ [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| Deck substructure | stiffening girders 39 ft on centre; **52-inch-deep plate girders as transverse floor beams at 25 ft**; five 21-inch rolled beams as longitudinal stringers at 5 ft 9 in; **5¼-inch concrete roadway** | ✅ [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) |
| Main cables | **17⅛ in diameter**, 19 strands of 332 × No. 6 cold-drawn galvanised wire; **sag ratio 1/12**; four **1¼-inch suspenders at 50 ft** along each cable | ✅ [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) |
| Deck dead load | **5,700 lb per linear foot** — confirmed independently by WSDOT's own Span Stats ("Weight of center span **5,700 lb./ft**") and American Heritage. Comparison: the George Washington Bridge roadway weighed **31,590 lb per linear foot** — i.e. Tacoma was **~5.5× lighter per foot** | ✅ [WSDOT](https://www.wsdot.wa.gov/TNBhistory/1940-bridge.htm); [American Heritage](https://www.americanheritage.com/content/tacoma-narrows-bridge-falling-down) |
| Centre span mass | **~3.5× lighter than the Golden Gate Bridge**. EBSCO says **three times more flexible** than the Golden Gate | 🟡 [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses) |
| Lanes | **2**, with shoulders; designed for light traffic | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Clearance below | **195 ft / 59.4 m** | ✅ [Wikipedia infobox](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Design wind load | **120 mph** | 🟡 [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses); [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) |
| Rank at the time | **3rd-longest suspension bridge in the world**, behind the George Washington Bridge and the Golden Gate Bridge | ✅ |

**⚠️ Deck-weight footnote.** Billah & Scanlan's section-model analysis uses a deck weight of **2,850 lb/ft** — about half of American Heritage's 5,700 lb/ft figure. Different conventions (per half-deck vs whole deck, or section-model scale values) are the likely cause. **If you quote one, quote the source with it.** ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf), pp. 122–123)

### 2.2 The slenderness comparison — this is the heart of the story

| Bridge | Span ÷ stiffener depth | Span ÷ width | Deck dead load |
|---|---|---|---|
| **Tacoma Narrows (1940, built)** | **350 : 1** (or 375 : 1) | **72 : 1** (or 75:1 / 78:1) | 5,700 lb/ft |
| Tacoma Narrows (**Eldridge's rejected** design, 25-ft trusses) | **112 : 1** | — | — |
| **Era's rule of thumb** | **≤ 150 : 1** | — | — |
| Williamsburg Bridge (NYC) | **40 : 1** | — | — |
| Golden Gate Bridge | Tacoma was "more than two times" worse | Tacoma was "1.5×" worse | ~3.5× heavier |
| **Tacoma Narrows (1950 replacement)** | **85 : 1** | **53 : 1** | ~1.6× the 1940 weight |

Sources: [American Heritage](https://www.americanheritage.com/content/tacoma-narrows-bridge-falling-down) (350:1, 112:1, ≤150 rule, Williamsburg 40:1); [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/) (375:1, 75:1, "1.5× and more than two times the Golden Gate", 3.5× lighter); [Old Structures / HAER](https://oldstructures.com/2022/04/06/significant-differences/) (78:1 → 53:1, 350:1 → 85:1).

**The mechanism in one sentence, per Ammann (who sat on the 1941 inquiry):** a suspended deck's torsional resistance is governed **predominantly by its vertical stiffness**, not its width. Tacoma's 8-ft girders were **1/350 of the centre span**, its suspended weight was "less than one half" the Whitestone's, and its width-to-span was "an unusually low 1:72" — together producing "an **exceedingly small resistance against the dangerous torsional oscillations which ultimately brought about destruction**." ([Ammann 1953, pp. 237–238, 242](https://www.bscesjournal.org/wp-content/uploads/Vol-40_No-3_July-1953.pdf))

### 2.3 Solid plate girder — and the open-grating question ✅ RESOLVED

**Your belief is correct on both counts.**

- **The 1940 deck was a SOLID plate girder deck — not a truss, and not open grating.** Wikipedia: "The original Tacoma Narrows Bridge was the first to be built with girders of carbon steel anchored in concrete blocks; preceding designs typically had **open lattice beam trusses** underneath the roadbed. This bridge was the first of its type to employ **plate girders** (pairs of deep I-beams) to support the roadbed… With the earlier designs, any wind would pass through the truss, but in the new design, **the wind would be diverted above and below the structure**." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing UW Libraries)
- **Open grating / open wind grates came later, with the 1950 replacement.** "All of the new designs would feature a **deep open stiffening truss instead of a solid plate girder**," plus "a design using **open strips of wind grating** placed in the roadway, which added even greater stability against torsional movement." The 46-ft roadway was split into four lanes "each separated by a **3-inch-deep, 33-inch-wide open air wind grate**", with 19-inch open-air grates outboard. ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950))) **⚠️ Wikipedia's "3-inch-deep" is wrong — the primary source says **five-inch** grating (see §6.1).**
- Ammann's aerodynamic verdict on the 1940 cross-section: it "consisted essentially of a **solid deck flanked by the vertical solid-web plate stiffening girders**" — "the **aerodynamically very unfavorable cross section**." ([Ammann 1953, p. 238](https://www.bscesjournal.org/wp-content/uploads/Vol-40_No-3_July-1953.pdf))

**Script-safe framing (from the physics pack):** *A truss is a sieve; a plate girder is a sail.*

---

## 3. The oscillation history before collapse

### 3.1 Kind of motion: vertical bending / heaving — NOT torsion

- During construction, "the bridge sometimes developed **up-and-down wave motions** of extraordinary amplitude." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))
- "**In the four months of active life of the bridge before failure, only vertical vibrations were observed prior to November 7, 1940.** Many such transverse modes of vibration were observed. The main towers were nodes of course, and there were from **0 to 8 nodes** between the two main towers." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))
- This was a **transverse (bending/heaving) mode**, "one-half of the central span rising while the other lowered." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

**⚠️ Critical script point: torsion had NEVER occurred before the morning of 7 November.** "the torsional oscillations did not occur until the day of the collapse." And when it came, "The change to torsional mode **appeared to take place without any intermediate stages and with such extreme violence that the span appeared about to roll completely over**." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))

### 3.2 Amplitudes and frequencies of the pre-collapse vertical motion

| Mode | Frequency | Max recorded double amplitude (crest to trough) |
|---|---|---|
| 2 nodes between towers | **12 vibrations/min (0.2 Hz)** | **~5 ft** |
| Fundamental, 0 nodes | **8 vibrations/min (0.133 Hz)** | **~2 ft** |

Both from the [AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf), drawing on the Texas A&M and UW Engineering Experiment Station bulletins and Farquharson's own communication. Script-worthy: "When the bridge was vibrating in this mode some motorists were uneasy at **seeing a car ahead disappear from view**, only to reappear again later during the crossing."

Ammann's 1941 observation, as reported by STRUCTURE: "oscillations with amplitudes of **48 inches (4 ft)** were observed at **16 cycles/minute at wind speeds of 3 to 4 mph**." ([STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/))

### 3.3 The counter-intuitive fact that kills the "resonance" story

> "both observation and theory agree that there was **no significant correlation between wind velocity and amplitude of vibration**. Motions of several feet were sometimes observed with wind velocities **as low as 3 or 4 miles/hour**; at other times the bridge **remained motionless in winds as high as 35 miles/hour**." — [AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)

This is the cleanest single piece of evidence that the motion was **not** driven at a fixed resonant wind speed. STRUCTURE reports the same: "oscillations having no effect due to wind turbulence or traffic loading… the bridge remained motionless on occasions in winds varying from 0 to 35 mph."

### 3.4 The damping measures, and why each failed

| Measure | Detail | Why it failed |
|---|---|---|
| **Tie-down cables** | Cables from the plate girders to **50-ton concrete blocks on shore**. AAPT: hold-downs tied the girders **in the side spans** to massive concrete blocks on land. | "This measure proved ineffective, as **the cables snapped shortly after installation**." They "reduced the waves in the side spans but **not in the main span**." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) |
| **Inclined cable stays** | **A pair** of 1½-inch-diameter inclined stays from the main cables to the deck **at mid-span**. | "These remained in place until the collapse but were also ineffective." STRUCTURE: "**the stay ropes slipped**." In fact they were load-bearing for the failure: one broke, one cable clamp slipped. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) |
| **Hydraulic buffers / dampers** | **One at each end of the main span**, between the towers and the deck floor system, to damp longitudinal motion. EBSCO describes them as "piston-in-cylinder mechanisms similar to automobile shock absorbers." | "The effectiveness of the hydraulic dampers was nullified… because **the seals of the units were damaged when the bridge was sand-blasted before being painted**." AAPT: they "became inoperative soon after installation." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses)) |

**Script line:** *Every brake they fitted was disconnected — the tie-downs snapped, the stays slipped, and the dampers had been ruined by the sandblasting that was meant to prepare the paint.*

**⚠️ Unverified:** the **number** of tie-down cables, and the **exact date** the tie-downs snapped ("shortly after installation" is all the sources give).

---

## 4. The collapse itself: 7 November 1940

### 4.1 Wind — the hook of the whole video

**The wind was MODERATE. This is the most important number in the story.**

| Figure | Conversion | Source |
|---|---|---|
| **42 mph** | **67.6 km/h / 18.8 m/s / 36.5 knots** | Farquharson: "it was a **steady, rather strong wind of about 42 miles/hour**." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) |
| **40–45 mph** that morning | 64–72 km/h | "The wind velocity was **40 to 45 miles/hour, larger than any previously encountered** by the bridge." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) |
| **42 mph** | — | [ASCE](https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/tacoma-narrows-bridges): "failed dramatically in a **rather moderate 42 mph windstorm**" |
| **"forty-two-mile an hour wind"** | — | [New York Times, 8 Nov 1940](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)): "Cracking in a forty-two-mile an hour wind, the $6,400,000 Tacoma Narrows Bridge collapsed with a roar today…" |
| **40 mph** | **64 km/h** | [Wikipedia lead](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| **18 m/s** | **40.3 mph / 64.8 km/h** | [Song et al. 2022, JFM 949 A11](https://doi.org/10.1017/jfm.2022.748): "The wind speed during the collapse of the TNB in 1940 was 18 m s⁻¹" |
| **38 mph at 8:30 a.m.** (Eldridge's crossing); rising to **42 mph by ~10:00 a.m.** | 61 / 67.6 km/h | [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses) |
| **Critical flutter speed ~35 mph** | **56 km/h** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing Billah & Scanlan p. 123 |

**Framing:** the bridge was **designed for 120 mph winds** and had **already survived a 50 mph storm**, yet it destroyed itself at **~42 mph**. That gap between "design load" and "destruction load" is the entire point — the failure was **not a strength problem, it was a stability problem**. ([EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses))

**⚠️ Where the 42 mph was measured — partly resolved; the INSTRUMENT is not.**
- **Location (sourced):** Green & Unruh state "the often quoted 42 mph for the wind was **measured on the deck of the bridge** before the bridge went into its torsional oscillation." WSDOT says engineers "**clocked** the wind at 42 miles per hour **near the bridge's east end**," and records **38 mph at 7:30 a.m.** ([Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854); [WSDOT](https://www.wsdot.wa.gov/TNBhistory/collapse.htm))
- **Instrument: still UNVERIFIED.** **No source names an anemometer** — not WSDOT, not the 1941 FWA report, not Green & Unruh. Farquharson's documented field instruments (per Olson, Wolf & Hook) were "a **surveyor's transit**, reference targets… and a **stopwatch**" — used for *oscillation*, not wind. **Do not name an instrument on screen.**
- Farquharson's *Bulletin 116* (the full measurement report) is print-only, 1949–1954, and was not retrievable. Catalogued at [Stanford SearchWorks](https://searchworks.stanford.edu/view/4402604).

**Bonus weather context:** the same low-pressure system went on to cause the **1940 Armistice Day Blizzard**, which killed **145 people** in the US Midwest four days later. ([Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637))

### 4.2 Minute-by-minute sequence

All times PST. Principal sources: [AAPT teacher's guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf) (drawing on the 1944 Texas A&M bulletin, the UW *Bulletin 116*, and direct communication with Farquharson), [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses), [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/), [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)).

**⚠️ On the "10:00 a.m." timestamp.** The familiar "10:00 a.m. — start of torsional vibrations" is **the title card of Franklin Miller's 1963 teaching film**, not a measured time. The primary accounts differ: **WSDOT says torsion began at 10:03 a.m. and was "gigantic" by 10:07**; **UW Libraries says ~10:15**; Olson, Wolf & Hook say "a few minutes after 10." **Do not attribute "10:00" to WSDOT.**

| Time | Event |
|---|---|
| **Several days earlier** | In a **midnight storm**, the **K-bracing under the deck was probably weakened**. Observed by only one person, who reported behaviour "different from any previous behavior." ([AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) |
| **~7:30 a.m.** | WSDOT records the wind at **38 mph**. ([WSDOT](https://www.wsdot.wa.gov/TNBhistory/collapse.htm)) |
| **~8:30 a.m.** | **Clark Eldridge** drives across in a **38 mph** wind. He feels the familiar undulation and is **not alarmed** — the bridge had survived 50 mph. |
| **~9:30 a.m.** | The span vibrates in **8 or 9 segments** at **36 vibrations/min**, **double amplitude ~3 ft**. Farquharson drives on and begins filming and measuring. Photos at midspan show the diagonal stays alternately slack. |
| **~10:03 a.m.** (WSDOT; "a few minutes after 10" per Olson et al.; ~10:15 per UW Libraries) | **The abrupt transition.** The main span "**abruptly began to vibrate torsionally in two segments with a frequency of 14 vibrations/minute**." WSDOT: by **10:07** the motion was "gigantic." Later the torsional frequency settles to **12 vibrations/min**. "The amplitude of torsional vibration quickly built up to about **35° each direction from the horizontal**." |
| **~10:00 a.m.** | **The mechanical trigger:** the **cable band (collar) on the NORTH main cable at mid-span starts slipping** back and forth with a **double amplitude of about 42 inches**. This lets one cable become effectively longer on one side of midspan and shorter on the other — **unlocking the 1-node torsional mode**. |
| **~10:00 a.m.** | **Leonard Coatsworth** drives on with his daughter's dog, **Tubby**; wind now **42 mph**; "the deck rose and fell **3 feet every 90 seconds**." His car is thrown against the curb; he escapes and crawls east. |
| **~10:30 a.m.** | A **large chunk of concrete** drops from the central span. The wind subsides; the bridge steadies somewhat. Photographers arrive. **Howard Clifford** tries to reach Tubby and fails; **Farquharson** reaches the car but **Tubby bites his finger**. |
| **~11:00–11:08 a.m.** | A section of the suspended superstructure — **~600 ft** — **tears loose and drops 210 ft into Puget Sound**. One suspension cable **slips from its saddle atop a tower**. |
| **11:02 a.m.** | EBSCO's timestamp for that first big section dropping. |
| **11:08 a.m.** | **WSDOT's own chronology gives 11:08** as the end. |
| **~11:10 a.m.** | **Most of the central span is gone** ("By 11:10 a.m., most of the central span was gone, and the bridge was quiet" — EBSCO; WSDOT's collapse page says "By 11:10 it was over"). |
| After | The side spans follow; the cables take up a free-hanging catenary; the towers sag shoreward. |

**Duration of the torsional motion:** roughly **45 minutes** (10:00 → 11:00; Billah & Scanlan) or **about one hour** (Song et al., "around 10:00" → "at 11:00"). **Note: "45 minutes" is Billah & Scanlan's figure; Song et al. do NOT say 45 minutes — "45" in their paper is only the 45° amplitude.** ([Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637); [Song et al. 2022](https://doi.org/10.1017/jfm.2022.748))

**Twist amplitude — the sources give four related numbers. Report the range, not one figure:**
- **±35°** — Farquharson: "amplitude of torsional vibration quickly built up to **about 35° each direction from the horizontal**." ([AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) ✅ **Best single figure.**
- **~45° at the quarter points**, with "cable amplitudes of approximately **28 feet**." ([STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/)) ✅
- **~45°** again, described vividly: "the roadbed tilted at a **45-degree angle**, pushing the **left sidewalk about 28 feet below the right sidewalk**… in **5-second intervals**." ([EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses))
- **≈13 ft / "greater than 0.7 rad" ≈ 40°** (given the 39-ft width). ([Green & Unruh 2006, p. 707](https://api.crossref.org/works/10.1119/1.2201854)) ✅
- **~30°** — Vice attributes this to Farquharson. 🔴 *Popular source; verify before use.* ([Vice 2015](https://www.vice.com/en/article/the-myth-of-galloping-gertie/))

**⚠️ Two numbers in circulation are NOT supported:** **"28°" and "38°" appear in no source I could find.** The "28" in the record is **28 *feet* of edge displacement**, not 28 degrees. Watch for that confusion.

**Safe script line:** *"About ±35° by Farquharson's own measurement — and up to roughly 45° at the quarter points. The two edges of the roadway were swinging some 28 feet past each other, once every five seconds."*

### 4.3 What failed first, and in what order

**Answer: the cable band (the mid-span cable collar) failed first — not the suspenders, and not the girders.** This is the single most important mechanical detail, and it comes from Farquharson:

> "The crucial event shortly after 10 a.m. which directly led to the catastrophic torsional vibration, was apparently **the loosening of the north cable in its collar** which was tied to the deck girder by diagonal stays. If these ties are very secure they tend to inhibit the 1-node torsion mode. If they are weak and loose, this mode, if externally excited, can proceed more easily to large amplitudes. For the Tacoma Narrows Bridge, the diagonal ties **did inhibit this mode at first but they became loosened (one broke, one cable clamp slipped)**. The mode was then driven by **auto-excitation forces of which the steady wind was the energy source**… Evidently, at about 10 a.m., this collar **started to slip back and forth, with a double amplitude of about 42 inches**. This allowed the structure to twist as one of the main cables became longer on one side of the center and shorter on the other side." — [AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)

**Full failure chain:**
1. **K-bracing under the deck weakened** in a storm several days earlier.
2. Existing vertical motion throws added stress onto the diagonal stays; **one stay breaks, one cable clamp slips**.
3. **North main cable's mid-span collar (cable band) slips**, double amplitude ~42 in.
4. That slip **unlocks the 1-node antisymmetric torsional mode**.
5. **Aeroelastic (self-excited) torsional flutter** grows the twist without bound.
6. **Suspender cables fail progressively.** Wikipedia: "the amplitude of the motion… increased beyond the strength of a vital part, in this case the **suspender cables**. As several cables failed, the weight of the deck transferred to the adjacent cables, which became **overloaded and broke in turn** until almost all of the central deck fell into the water." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
7. **Order of spans: centre span first, then the side spans.** The first big drop is a ~600–650 ft section at ~11:00–11:02 a.m.; "By 11:10 a.m., most of the central span was gone."

**Damage accounting** (Farquharson, via the [AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)):
- Cables stayed intact **except a 42-inch section of the north cable** scraped by the sliding collar.
- **500 of 6,308 No. 6 galvanised cold-drawn steel wires were ruptured** by the sliding collar.
- **Tower sag — use 12 ft.** WSDOT and Wikipedia both record the towers "deflected **12 ft (3.7 m)** towards shore as a result of the collapse of the mainspan and the sagging of the sidespans." **The AAPT/Farquharson "25 feet" figure is an outlier that no other source supports** — treat it as unreconciled and prefer 12 ft. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [WSDOT](https://www.wsdot.wa.gov/TNBhistory/1940-bridge.htm))

### 4.4 Casualties — human and animal

- **NO HUMAN DEATHS.** ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [ASCE](https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/tacoma-narrows-bridges): "Although no human life was lost…"
- **Injuries:** Wikipedia notes the collapse "inflicted injuries on people fleeing the disintegrating bridge or attempting to rescue the stranded dog." **Farquharson was bitten on the finger by Tubby.** ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses))
- **The only fatality was a dog: "Tubby," a Cocker Spaniel owned by Leonard Coatsworth's daughter.** Tubby had **three legs**. Coatsworth left him in the car; Tubby refused to leave and perished with the bridge. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf))
- **People on the bridge that morning:**
  - **Leonard Coatsworth**, editor at *The News Tribune* — crawled ~500 yd on hands and knees; his words are the most-quoted eyewitness account.
  - **Ruby Jacox and Arthur Hagen**, employees of the Rapid Transfer Company — their delivery truck tipped over; they escaped on foot.
  - **Winfield Brown**, a college student who had walked on for the "roller-coaster effect," met Coatsworth and they staggered out together (EBSCO).
  - **Howard Clifford**, photographer for the *Tacoma News Tribune* — walked out to try to save Tubby, forced back when the span began breaking up.
  - **Frederick Farquharson** — walked off along the **centre nodal line** of the twisting deck, after trying to save Tubby.
  - **Clark Eldridge** — crossed earlier, at ~8:30 a.m., and returned to his office.

**✅ "The last person on the bridge" — SETTLED: it was FARQUHARSON. This is no longer a three-way tie.**

WSDOT ranks the exits explicitly (Weird Fact #23): "**Brown outran Coatsworth. Coatsworth was already back safely when Clifford sprinted past Elliot. Farquharson stayed after Elliot straggled to the safety of the Toll Plaza. Farquharson… was the last man on Galloping Gertie.**" Farquharson himself said: "**I was the only person on the Narrows Bridge when it collapsed.**" ASCE (2023) concurs. ([WSDOT Weird Facts](https://www.wsdot.wa.gov/TNBHistory/weird-facts.htm))

**The apparent conflict dissolves once the roles are separated:**
- **Leonard Coatsworth** was the last person to **drive** onto the bridge (American Heritage) — not the last person *on* it.
- **Howard Clifford** (photographer) sprinted past "Elliot" and got out before Farquharson.
- **Arthur Leach** holds a *different* record: the last person to **cross to the WEST side** — he was a toll collector who went west to stop further crossings. Previously unseen film he shot from the Gig Harbor side emerged in **February 2019**. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

**Best on-screen line:** *"The last human being on Galloping Gertie was Burt Farquharson — the engineer who had spent months trying to save it. He walked off along the centre line of the twisting deck, and then it tore itself apart."*

### 4.5 Who filmed it, and the footage

| Question | Answer | Source |
|---|---|---|
| Who filmed it | **Barney Elliott and Harbine Monroe**, owners of **The Camera Shop** in Tacoma | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [UW film archive](https://content.lib.washington.edu/filmarchweb/tacoma.html) |
| Also credited | Farquharson himself "took some of the pictures that appeared in the original films" | [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| Format | **16 mm Kodachrome colour** — the colour original | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Why most copies are B&W | Newsreels of the day copied the film onto **35 mm black-and-white stock** | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Distribution | Sold to **Paramount Pictures**; duplicated for newsreels worldwide; **Castle Films** received **8 mm home-video** rights. Also incorporated into Episode 1 of the 1950 serial *Atom Man vs. Superman* | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| Award | Elliott "won a prize for the outstanding newsreel film of 1940" | [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| Archive | Elliott "turned the film over to the film library of the **University of Washington**, Seattle" | [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| Preservation | In **1998**, *The Tacoma Narrows Bridge Collapse* was selected for the **National Film Registry** by the Library of Congress as "culturally, historically, or aesthetically significant" | ✅ [Library of Congress](https://www.loc.gov/programs/national-film-preservation-board/film-registry/complete-national-film-registry-listing/) |
| A third reel | **Arthur Leach's** footage, shot from the Gig Harbor (west) side — one of the few known records from that side — surfaced **February 2019** | ✅ [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |

**⚠️ "Faris" — I found NO person by that name in this story.** The two named cameramen are **Elliott** and **Monroe**. Treat "Faris" as a confusion and do not use it. *(UNVERIFIED / likely apocryphal.)*

**🎬 THE FILM-SPEED TRAP — a superb script beat.**
- **Monroe filmed at 24 fps; Elliott filmed at 16 fps.**
- Film-to-video transfers **assumed 24 fps**, so most copies in circulation show the bridge oscillating **~50% faster than real time**.
- Concretely: counting frames gives **18 twisting cycles per minute** on the video; Farquharson's **stopwatch on the day gave 12 cycles per minute**. Texas State University researchers proved the 16 fps origin and reconciled the two. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing [Seattle Post-Intelligencer, 7 Nov 2015](http://www.seattlepi.com/science/article/A-Tacoma-Narrows-Galloping-Gertie-bridge-6617030.php); [Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637))
- **Script line:** *"The most famous collapse film in history is played 50% too fast — the bridge you have seen a hundred times never moved like that."*

**🚨 COPYRIGHT STATUS — UNRESOLVED. DO NOT ASSERT PUBLIC DOMAIN. Clear this before broadcast.**
The full documented chain, from the second research pass:
**The Camera Shop (Elliott/Monroe)** → **Paramount Pictures** bought the film and duped the colour to B&W for worldwide newsreels → **Castle Films** bought 8 mm distribution rights (title: *Disaster! The Greatest Camera Scoop of All Time*) → **University of Washington** holds Farquharson's film, marked "**used for scholarly study only**" → the **AAPT DVD is "Copyright © 2000 AAPT"** → **Franklin J. Miller's 1963 film** (Ohio State University, NSF-funded) is marked "**All rights reserved. Not licensed for television use.**" ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf); [UW film archive](https://content.lib.washington.edu/filmarchweb/tacoma.html))

**Key findings:**
- **No source anywhere declares the footage public domain.** No copyright renewal or expiration record was found.
- **There is no US-government-work basis** for a public-domain claim: the cameramen were private individuals (a commercial camera shop), not federal employees.
- **National Film Registry selection is an honour, not a licence** — it does not change copyright status.
- **Action item: obtain rights from the UW film archive or the current rights holder.** Budget for this as a real cost, not a formality.

---

## 5. The physics mechanism

> **This is the video's core. A longer, fully referenced treatment — including direct quotations from Billah & Scanlan (1991), Green & Unruh (2006), Song et al. (2022), Ammann (1953) and MIT 18.03 — is in the companion file `research/tacoma-narrows-physics-factpack.md`. What follows is the script-ready digest.**

### 5.1 Forced vibration vs. resonance vs. self-excited oscillation

| | **Forced vibration** | **Resonance** | **Self-excited oscillation (flutter)** |
|---|---|---|---|
| What sets the frequency | the external driver | the driver, tuned near a natural frequency | **the structure itself** — the motion sets the phase of the force |
| Is a natural frequency involved? | not necessarily | **yes, by definition** | the natural frequency appears, but the *instability* does not need the driver to match it |
| Amplitude vs. driving frequency | rises gradually | **peaks sharply** at ω ≈ √(k/m) | **no peak** — grows monotonically with wind speed past a threshold |
| Where the energy comes from | the external driver | the external driver, efficiently | a **steady** source, tapped by the motion itself |
| What stops the growth | damping | damping | **nothing linear** — grows without bound until nonlinearity or structural failure |

Sources: [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf), pp. 119–121; [Wikipedia, Aeroelasticity](https://en.wikipedia.org/wiki/Aeroelasticity); [Jenkins, "Self-oscillation," arXiv:1109.6640](https://arxiv.org/html/1109.6640v1).

**Definition of flutter (Wikipedia, *Aeroelasticity*):** "a dynamic instability of an elastic structure in a fluid flow, caused by **positive feedback** between the body's deflection and the force exerted by the fluid flow. In a linear system, 'flutter point' is the point at which the structure is undergoing simple harmonic motion — **zero net damping**. 'Net damping' can be understood as the sum of the structure's natural positive damping and the **negative damping** of the aerodynamic force." ✅

### 5.2 Why the textbook "resonance with wind gusts" story is WRONG

Five independent reasons, each sourced:

1. **The wind has no periodicity.** Billah & Scanlan: "Some texts suggest that this force was supplied by 'gale winds' or 'gusts of wind,' etc. But '**gusts' and 'gales' do not connote any well-defined periodicity**." MIT 18.03 is blunter: "The problem with this explanation is that the wind was **not gusting** — certainly not at anything like the natural frequency of the bridge. **This explanation is worthless.**" ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 119; [MIT 18.03 §17](https://math.mit.edu/classes/18.03/sup/sup17.pdf))

2. **The failure frequency was not a natural frequency of the isolated structure.** Farquharson measured the destructive mode at **12 cycles/min = 0.2 Hz** — "neither a natural mode of the isolated structure **nor** the frequency of blunt-body vortex shedding of the bridge at that wind speed, which was approximately 1 Hz." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing Farquharson, UW *Bulletin 116*)

3. **For a heavy bridge, the aerodynamic force barely touches the mode — it flips the damping.** "In the quite different case of the heavy structure of bridges, the aerodynamic forces… do **not** greatly influence the responding modes nor their frequencies. They can and do influence the overall **damping**, however, **reversing it in sign at the higher wind speeds**." ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 122)

4. **Amplitude grows monotonically with wind speed instead of peaking at a resonant speed.** Feldman (2003) found "no resonance behavior in the amplitude as a function of the wind velocity"; the AAPT DVD user's guide now states the collapse "**was not a case of resonance**." ([Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637); Feldman, *The Physics Teacher* 41 (Feb 2003), 92–96)

5. **The resonance story began as a newspaper line, not a physics result.** "That assertion perhaps first appeared in a newspaper article, 'A great bridge falls,' published in the *New York Times* on **9 November 1940**: 'Time successive taps correctly and soon the pendulum swings with its maximum amplitude. So with this bridge. What physicists call **resonance** was established.'" ([Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637)). The 1941 **Federal Works Agency** report — with von Kármán on the board — had already rejected vortex resonance: "It is very improbable that resonance with alternating vortices plays an important role… there is **no sharp correlation between wind velocity and oscillation frequency**." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))

**The honest caveat (useful for a "scientists still debate" beat):** "To some degree the debate is due to the lack of a commonly accepted precise definition of resonance." Billah & Scanlan themselves concede the semantic edge: *self-excited* systems "differ strongly enough from ordinary linear resonant ones" that the distinction is mathematically clear, even if one could stretch the word "resonance" to cover it. ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 122)

### 5.3 The energy feedback loop — and negative damping

```
steady wind  →  separates over a solid, bluff deck
        ↓
deck twist  →  changes the deck's effective angle of attack
        ↓
low-pressure vortex forms on one side, then drifts across the deck
        ↓
aerodynamic torque acts IN PHASE WITH VELOCITY
        ↓
more twist  ←  the loop closes: energy is fed IN, not bled out
```

**Negative damping in plain terms (script-ready):**
> Damping is any force that opposes motion — it drains energy and kills vibration. **Negative** damping is a force that *aligns with* the motion: it pushes the way you are already going, and the faster you move, the harder it pushes. The structure keeps drawing energy out of the moving air, and its amplitude grows **exponentially**. ([Jenkins, arXiv:1109.6640, §VI](https://arxiv.org/html/1109.6640v1))

**MIT's differential-equation version** (write the aerodynamic force as *F = −k(v)θ − b(v)θ̇*):
> "when |v| is small, b(v) > 0: the wind actually **increases** the damping of the bridge; it becomes more stable. When |v| is somewhat larger, b(v) = 0… When |v| increases still more, b(v) becomes **negative** and it starts to erode the damping of the bridge, till, when it hits a certain critical value, it overwhelms the intrinsic damping. The result is **anti-damping, a negative effective damping constant**." Solutions become θ = A e^{at} cos(ωt − φ) with **a > 0** — "Its peaks grow in magnitude, exponentially. **This spells disaster.**" MIT adds: "For the Tacoma Narrows Bridge, the critical value of velocity was discovered, on that day in November, 1940, to be **around 40 miles per hour**." ([MIT 18.03 §17](https://math.mit.edu/classes/18.03/sup/sup17.pdf))

**Where the energy physically enters (Green & Unruh):** "a vortex is a low-pressure region… a **force in the direction of the vortex** is produced on the bridge"; "During the descent, the vortex crosses halfway and **the force is once again in the direction of motion**. As a result, **the bridge gains energy and the amplitude of oscillation grows**." Their instability condition: "the vortex **crosses the midway point in less than one period**, a requirement for negative damping." ([Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854), pp. 709–713)

**Billah & Scanlan's classification:** "**single-degree-of-freedom torsional flutter due to complex, separated flow**," with "effectively negative damping representing an inflow of wind energy caused by the **synchrony of motion-induced pressures with the motion itself**." ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf), pp. 121–122)

**The violin-bow analogy, from the source (AAPT teacher's guide):** "when the bow is drawn steadily across a violin string, energy is fed into the string from the muscles of the player. But the frequency of the vibration is controlled by the **string's mass, length, and tension**, not by any applied resonant frequency of the bow." ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) — Excellent for a Chinese-language explainer; it needs no equations.

### 5.4 Torsional flutter, and the two degrees of freedom

**The two motions:**
- **Vertical / heave / bending** — the deck rises and falls as a whole.
- **Torsional / twist / pitch** — the deck twists about its longitudinal centre line: one edge up, the other down, **centre line motionless**.

**What actually happened at Tacoma:** the final motion was the twist. Wikipedia: "when the left side of the roadway went down, the right side would rise, and vice versa, i.e., the two halves of the bridge twisted in opposite directions, **with the center line of the road remaining still (motionless)**." Billah & Scanlan call it a fundamental **antisymmetric torsion mode**, "one which had not manifested itself in the bridge response until some **45 min prior to the collapse**." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 122)

**Ammann independently identified this exact mode** as the killer: his "Stiffness Index" was built on the vertical deflection "under a static downward load covering one-half of the center span and a like upward load covering the other half," because "the resulting line of deformation corresponds closely to the **asymmetric mode of oscillation, with a single node at or near the center of the span**. **It was this mode which ultimately wrecked the Tacoma Bridge.**" ([Ammann 1953, p. 242](https://www.bscesjournal.org/wp-content/uploads/Vol-40_No-3_July-1953.pdf))

**Why a slender shallow deck has low torsional stiffness — Ammann's principle:** torsional resistance is governed **predominantly by vertical rigidity**, not width. If the suspended floor structure has a lateral truss in only one plane, "its own resistance to torsion is relatively **very small** and the torsional resistance of the entire suspended structure is governed predominantly by the **vertical rigidity** of the system. This has been the case with practically **all** suspension bridges which have failed or experienced excessive oscillatory motions under wind action." ([Ammann 1953, pp. 237–238](https://www.bscesjournal.org/wp-content/uploads/Vol-40_No-3_July-1953.pdf))

**Mode spacing — a strong citable point for the script:**

| Bridge | Span (ft) | Vertical mode (cycles/min) | Torsional mode (cycles/min) | Ratio |
|---|---|---|---|---|
| Verrazano (US) | 4,260 | 6.2 | 11.9 | **1.9** |
| Golden Gate (US) | 4,200 | 5.6 | 11.0 | **1.9** |
| Severn (UK) | 3,240 | 7.7 | 30.6 | **3.9** |
| **Tacoma Narrows** | **2,800** | **8.0** | **10.0** | **1.25** |

([AAPT guide, Table 3](https://aapt.org/Store/upload/tacoma_narrows2.pdf)) — Tacoma's two modes were **suspiciously close together**; modern practice keeps them far apart. The source says as much: "In general, it is wise to keep these two normal mode frequencies far apart."

**⚠️ On the heave–torsion coupling — a required correction.**
- The **classical aeronautical** picture — "binary flutter," two coupled degrees of freedom, each individually positively damped, becoming unstable through coupling — is correctly stated by Billah & Scanlan. ✅
- **But they explicitly warn against over-applying the aircraft analogy to Tacoma:** "the eventual flutter phenomenon that [a bluff bridge deck] will undergo is **not akin to airfoil flutter, but to a form of separated-flow flutter, which tends to excite mainly the torsional degree of freedom**… When this occurs, **even if two or more modes sometimes couple, the principal driving mechanism is found to lodge in a single unstable mode — usually torsion.**" ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 122)
- Modern simulation agrees: "Even without vertical vibration, the torsional vibration… occurs… suggesting that the **vertical vibration is not a necessary condition** for the occurrence and rapid growth of the torsional vibration in the presence of fluid flow." ([Song et al. 2022](https://doi.org/10.1017/jfm.2022.748))
- **⚠️ The "≈90° phase difference between heave and pitch"** is standard aeroelasticity but I could **NOT verify it to primary-source standard.** Attribute generically ("the two motions fall out of step by about a quarter of a cycle") or drop the exact figure. What *is* directly sourced is the general requirement that the driving force be "modulated in phase with the **velocity** of the displacement" rather than with position — which *is* a quarter-cycle offset. ([Jenkins, arXiv:1109.6640, §XVII](https://arxiv.org/html/1109.6640v1))

**Script-safe formulation:** *Two motions, each stable on its own, became lethal together — and the one that actually ran away was the twist. The vertical bobbing was the bridge's warm-up act; the twist was the killer.*

### 5.5 Kármán vortex shedding — what it does and does not explain

**Short answer: vortex shedding explains the smaller VERTICAL motion of the preceding months. It does NOT explain the final catastrophic twist.**

**What vortex shedding is.** Bluff bodies in a flow shed "**alternating low-pressure vortices** on the downwind side… the so-called Kármán vortex street. The body will… try to move toward the low-pressure zone… Eventually, if the frequency of vortex shedding matches the natural frequency of the structure, the structure will begin to resonate." Shedding frequency = **Strouhal frequency** *f_s D / U = S*, with *S ≈ 0.21* for Re > 1000. For Tacoma, *D* ≈ 8 ft, *S* ≈ 0.20. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

**The frequency argument:**

| Quantity | Value | Source |
|---|---|---|
| Collapse wind | 42 mph = **61.6 ft/s** | Farquharson via [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 120 |
| Blunt-body vortex shedding at that wind speed | **"close to 1 Hz"** (their stated figure) | [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 120; [Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854) p. 708 |
| Observed **destructive torsional** mode | **0.2 Hz = 12 cycles/min = 5 s period** | Farquharson, UW *Bulletin 116* |
| Video copies as usually played | 0.3 Hz = **18 cycles/min** (50% too fast) | [Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637) |
| Pre-onset **vertical** motion | **36–38 cycles/min ≈ 0.6 Hz** | [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |

**⚠️ Flag an arithmetic mismatch.** With the sources' own *D* = 8 ft and *S* = 0.20, the formula gives 0.20 × 61.6 / 8 = **1.54 Hz**, not 1 Hz. The stated "1 Hz" is quoted by Billah & Scanlan, Green & Unruh and Jenkins alike, but does not reproduce from those inputs. **The conclusion is unaffected** — 1 Hz or 1.5 Hz is 5–8× the 0.2 Hz of the actual failure. **Presentation advice: state "about 1 Hz" as the sources' figure, show the formula on screen, and do not present 1 Hz as a computed result.**

**Where the modern consensus sits — three tiers:**

1. **The early vertical motion: vortex shedding. Yes.** Billah & Scanlan: "during its brief lifetime late in 1940 the bridge **did** experience this sort of vibration, but safely: as it occurred in **purely vertical modes under relatively low-speed winds**. In fact, the slender bridge deck gained the sobriquet 'Galloping Gertie' from such oscillations." ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 120)
2. **The modern simulation confirms it numerically.** Song et al. find "The natural frequency of the vertical vibration (f_nat h/U = 0.1–0.105)… was very similar to the vortex-shedding frequency of the flow over a stationary deck (f_vs h/U = 0.111), which indicated that the vertical vibration was induced by the **lock-in with the vortex shedding**." Crucially: "the vertical vibration itself **does not evolve into fluttering** even in the presence of fluid flow but only experiences the resonance-induced lock-in." The torsional motion is categorically different — its vortex-formation frequency is "**very different from the natural vortex-shedding frequency** around the stationary deck." ([Song et al. 2022](https://doi.org/10.1017/jfm.2022.748))
3. **The final twist: NOT vortex shedding.** Billah & Scanlan: "It can be concluded that **natural vortex shedding was not the cause of the collapse**." And the killer inversion: "The final, destructive oscillation of the old Tacoma Narrows bridge produced a **flutter wake, not a Kármán vortex street**. This goes to the heart of a 'chicken-egg' dilemma: Did the vortices cause the motion or the motion cause the vortices? In this case (flutter) **it was the latter**." They explicitly criticise von Kármán's own popularisation ("The culprit in the Tacoma disaster was the Karman vortex street" — from Edson's biography of von Kármán): "We see the flutter vortex trail as a **consequence, not a primary cause**." ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf), pp. 120–122)

**Bonus irony worth a line:** von Kármán himself sat on the 1941 FWA board that *rejected* the vortex-resonance explanation — the popular "von Kármán vortex street killed the bridge" story comes from his later biography, not from his own engineering report. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf))

### 5.6 The solid plate girder's role

- Tacoma was "the **first** of its type to employ plate girders (pairs of deep I-beams) to support the roadbed." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- "With the earlier designs, any wind would pass through the truss, but in the new design, **the wind would be diverted above and below the structure**." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- Ammann: the failure was driven by the "**aerodynamically very unfavorable cross section**… a **solid deck flanked by the vertical solid-web plate stiffening girders**." ([Ammann 1953, p. 238](https://www.bscesjournal.org/wp-content/uploads/Vol-40_No-3_July-1953.pdf))
- **The separated-flow mechanism (Green & Unruh):** "The fluid will first flow around the solid truss at the leading edge, **separating from the boundary**. Due to the reduced density, a **low-pressure region will form behind the truss**." As the deck pitches, "a **large vortex forms on one side and a small vortex forms on the opposite side. This behavior will repeat every half period of the bridge's motion**." Then the vortex drifts across the deck: "**This wind will push the vorticity off the back edge**." ([Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854), pp. 709–712)
- **A truss or open deck breaks this up.** "Further simulations by Larsen show that the **critical wind speed is increased if the vortex formation at the leading edge is suppressed by replacing the solid trusses with perforated ones**." Modern practice: "Sometimes they include a **slot in the middle of the deck** to alleviate pressure differences above and below the road." ([Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854) p. 710; [Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637))
- Farquharson's two 1940 recommendations were exactly this: drill holes through the girders and deck, or add fairings/deflector vanes. **Option (b) was approved — five days too late.** ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [STRUCTURE](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/))
- **⚠️ Do not misquote Green & Unruh.** The phrase "large-scale vortices forming **alternately above and below** the deck" is **not verbatim**. Their abstract says "large scale vortices **above and below the deck**"; their mechanism passage says "a large vortex forms on one side and a **small** vortex forms on the opposite side… repeat every half period." Paraphrase, and flag it as a paraphrase.

### 5.7 Critical flutter speed — and why Tacoma's was so low

**Definition.** Flutter begins at a **critical wind speed U_c** — a threshold set by geometry and aerodynamics, *not* by gustiness. Below U_c the net damping is positive and any disturbance decays; **above U_c the net damping is negative and the amplitude grows without bound.** ([Wikipedia, Aeroelasticity](https://en.wikipedia.org/wiki/Aeroelasticity); [Wikipedia, TNB](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

**Tacoma's U_c — the estimates do not agree. Give the range, and say so.**

| Estimate | Source |
|---|---|
| **"above about 35 mph (56 km/h)"** — the round figure Wikipedia cites | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)), citing [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) |
| **~35 mph** — model response approaches "divergent" amplitudes at 5 ft/s model = 35 mph full scale | [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 123 |
| **15.91 mph** — incipient flutter in the 1:50 full-bridge model (3.3 ft/s × 50) | [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 123 |
| **18–27 mph** — Kármán & Dunn section-model range (3.4 < U/nB < 5.1) | [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 123 |
| **≈17.9–20.1 mph (8–9 m/s)** — modern full 3-D DNS | [Song et al. 2022](https://doi.org/10.1017/jfm.2022.748) |
| **U_c/(f_nat·B) = 3.56–4** (dimensionless) | [Song et al. 2022](https://doi.org/10.1017/jfm.2022.748); [Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854) |

**Key robustness point:** the **dimensionless** critical speed **U_c/(f_nat·B) ≈ 3.5–4** is stable across 30 years and many methods (Matsumoto et al. 1992: 4; Scanlan 1999: 3.55; Larsen 2000: 3.6–4; Szabó et al. 2020: 4; Hu et al. 2022: 3.5–4.4; Song et al. 2022: 3.56–4). The disagreement is only in converting it to mph, which depends on the assumed natural frequency and deck width. ([Song et al. 2022](https://doi.org/10.1017/jfm.2022.748))

**Why Tacoma's U_c was so low — the causal chain, all sourced:**
8-ft solid plate girders on an 853 m span (depth = span/350) → very low torsional stiffness (Ammann: torsional resistance follows *vertical* rigidity) → plus width-to-span 1:72 → plus a bluff, solid cross-section that maximises the motion-induced pressure asymmetry → so the wind speed at which aerodynamic damping changes sign is low.

**And the collapse wind was above U_c on every estimate** (40–45 mph vs U_c of 16–35 mph), which is exactly what a flutter story predicts. ([Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf) p. 123)

**What "grows without bound" means in practice:** the theory says exponential growth; reality ends when the steel does. "Eventually, the amplitude of the motion produced by the fluttering increased beyond the strength of a vital part, in this case the **suspender cables**." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

### 5.8 Where the science still disagrees (be honest on screen)

1. **What *triggered* the switch from vertical to torsional motion.** Candidates:
   - **Mid-span cable-band slip** throwing the load onto the stays (Farquharson/Ammann) — see §4.3.
   - **Internal resonance** of the structure itself — a purely structural, nonlinear energy transfer from the vertical to the torsional mode, requiring no aerodynamic instability to *initiate* it. ([Arioli & Gazzola 2015, *Appl. Math. Modelling* 39(2), 901–912](https://doi.org/10.1016/j.apm.2014.06.022))
   - **Song et al. dispute the structural-only answer**: Arioli & Gazzola's simulation "did not consider the aerodynamic effect of the wind"; and torsion grows at an energy threshold far below theirs. They largely **support** Billah & Scanlan. ([Song et al. 2022](https://doi.org/10.1017/jfm.2022.748))
2. **Whether the vertical mode is needed at all.** Song et al.: torsion grows even with vertical displacement set to zero — "the vertical vibration is **not a necessary condition**." ([Song et al. 2022](https://doi.org/10.1017/jfm.2022.748))
3. **The exact origin and wind-speed dependence of the negative damping.** Larsen's point-vortex leading-edge model vs Green & Unruh's leading vortex + trailing step function; Green & Unruh note Larsen's model "does not adequately explain the data or the simulations at wind speeds above 20 m/s." ([Green & Unruh 2006](https://api.crossref.org/works/10.1119/1.2201854) pp. 710, 714)

**What is settled:** it was **not forced resonance**, and it was **not Kármán vortex shedding** acting on the final torsional mode. ✅

### 5.9 The 1991 paper that corrected the textbooks

**K. Yusuf Billah & Robert H. Scanlan, "Resonance, Tacoma Narrows bridge failure, and undergraduate physics textbooks," *American Journal of Physics* 59(2), 118–124 (1991), doi [10.1119/1.16590](https://doi.org/10.1119/1.16590).** Free scanned PDF: [ketchum.org](http://www.ketchum.org/billah/Billah-Scanlan.pdf). Author affiliations: Billah, Princeton University; Scanlan, Johns Hopkins University. ✅

**Their own summary of the conclusion:** "the ultimate failure of the bridge was in fact related to an **aerodynamically induced condition of self-excitation or 'negative damping' in a torsional degree of freedom**. The aeroelastic phenomenon involved was an interactive one in which developed wind forces were strongly linked to structural motion. This paper emphasizes the fact that, **physically as well as mathematically, forced resonance and self-excitation are fundamentally different phenomena**."

**Their plain-language verdict (quoted in the AAPT teacher's guide):** "It was **not a case of resonance**, although that term is indeed erroneously used in one of the captions in the film first edited in 1962. True, there are some features similar to resonance… But **true resonance requires the periodic application of a small driving force in synchronism with a natural frequency of the structure. The wind had no such frequency; it was a steady, rather strong wind of about 42 miles/hour.**" ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))

**Other quotable lines:** "'Gusts' and 'gales' do not connote any well-defined periodicity." (p. 119) · "It can be concluded that **natural vortex shedding was not the cause of the collapse**." (p. 120) · "The final, destructive oscillation of the old Tacoma Narrows bridge produced a **flutter wake, not a Karman vortex street**." (p. 122) · "**it is probably time… to offer the next generation of students subtler, more complex, and correct explanations**." (p. 123)

**Companion paper for a physics-class framing:** Bernard J. Feldman, "What to Say About the Tacoma Narrows Bridge to Your Introductory Physics Class," *The Physics Teacher* **41** (Feb 2003), 92–96. ([cited in EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses))

---

## 6. Aftermath and lessons

### 6.1 The 1950 replacement — what changed

| Feature | 1940 bridge | 1950 replacement |
|---|---|---|
| Main span | 2,800 ft | **2,800 ft** (same piers) |
| Overall length | 5,939 ft | **5,979 ft** (40 ft longer) |
| Stiffening element | **solid plate girder, 8 ft deep** | **deep OPEN stiffening truss, 33 ft (~10 m) deep**, plus **open-air wind grates** in the roadway |
| Span ÷ depth | **350 : 1** | **85 : 1** |
| Span ÷ width | **~72–78 : 1** | **53 : 1** |
| Roadway width | 39 ft | **46 ft** |
| Lanes | 2 | **4** (each 9 ft 5/8 in wide) |
| Deck weight | baseline | **1.6×** the 1940 structure |
| Cable diameter | 17½ in | **20¼ in** |
| Cable load at anchorages | 28,000,000 lb | **36,000,000 lb** |
| Towers | 443 ft above water / 425 ft above piers (WSDOT); **436 ft unsupported** | **500 ft above water / 467 ft above piers** (WSDOT); HAER says 462 ft; AAPT says 507 ft — **sources conflict, avoid the number** |
| Opened | 1 July 1940 | **14 October 1950** |
| Nickname | "Galloping Gertie" | **"Sturdy Gertie"** |

Sources: [1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)); [main TNB article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge); [Old Structures/HAER](https://oldstructures.com/2022/04/06/significant-differences/); [AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf).

**The open-grating detail — a direct answer to your question.** The new design used "a design using **open strips of wind grating** placed in the roadway, which added even greater stability against torsional movement." Each lane was separated by a **33-inch-wide open air wind grate**; a **19-inch open air grate** bounded the outside lanes. ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)))

**⚠️ Correction: the grates were FIVE inches deep, not three.** Wikipedia says "3-inch-deep"; the **primary source** — the Washington Toll Bridge Authority *Final Report* (Charles E. Andrew, June 1952) — specifies "**five-inch I-Beam-Lok open floor grating**." The **33-in and 19-in widths are confirmed by both.** **Use five inches.**

**Cost — the primary accounting is now available; the popular figures are unreliable.**
- **Authoritative total: $14,011,384.28** as of **30 June 1952**, from the Washington Toll Bridge Authority *Final Report* (Charles E. Andrew, June 1952).
- WSDOT gives a construction price tag of **$11.2 million** (one-third more than the estimate) with a final construction cost estimate of **$13,738,000**.
- A 1950 Associated Press report says **$18 million** — **an outlier; do not use it.**
- Design and testing alone cost **$80,000**. ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)); [main TNB article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge))

**⚠️ WSDOT contradicts itself on the 1950 span-to-depth ratio:** its prose says **1:85**, its own Span Stats table says **1:112**. HAER gives **85**. **Prefer 85 but flag the conflict** — or avoid the number and say "the stiffening truss was 33 ft deep instead of 8 ft." (Ratio 2800/33 = 84.8, which supports 85.)

**Design team:** In July 1941 the Washington Toll Bridge Authority appointed **Charles E. Andrew** (a consultant on Gertie) as principal engineer and chairman of the consulting board; **Dexter R. Smith** was lead designer; the board included **von Kármán**, **Glenn Woodruff**, and **Sverdrup and Parcel**. Notably, the new design "closely resembled the original design for the 1940 span drawn up by **Clark Eldridge**" — the 25-ft-truss concept, vindicated. ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)))

### 6.2 The birth of wind-tunnel testing for long-span bridges

- **Before:** "A purely mathematical solution to designing suspension spans was not possible because little was known about the forces that brought down Gertie." Charles Andrew: "**The only way to attack the problem, was to design a bridge, then build a model of that design and subject it to wind action.**" ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)))
- **Facility:** Farquharson worked in "a specially designed wind tunnel laboratory built on the University of Washington campus in Seattle… large enough to house a scale model of the completed bridge as long as **100 ft**, plus section models." Completed **1943**. ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)))
- **Scale:** Testing began **November 1943** and continued **through 1945**; the studies included **200 different configurations**, with wind hitting the span at up to **±45°** to the perpendicular. ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950))). Miller/AAPT describe a dynamic **1:50** full-bridge model for the new design ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf)).
- **For the original bridge, Farquharson used a 1:200 full-bridge model and a 1:20 section model** ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940))).
- **Result:** the 1950 bridge "was the **first to be designed and tested in wind tunnels**, and was the **first suspension bridge designed and built with hydraulic motion damping devices**." ([1950-bridge article](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)))
- **Legacy:** "Wind-tunnel testing of bridge designs eventually became **mandatory**." ([History.com via Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- **The design lesson generalised:** "A key consequence was that suspension bridges reverted to a **deeper and heavier truss design**… until the development in the 1960s of **box girder bridges with an airfoil shape** such as the **Severn Bridge**, which gave the necessary stiffness together with reduced torsional forces." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

### 6.3 Comparable retrofit: the Bronx–Whitestone Bridge

- Of similar design to the 1940 Tacoma span; **reinforced shortly after the collapse.** Wikipedia: "**Fourteen-foot-high (4.3 m) steel trusses were installed on both sides of the deck in 1943** to weigh down and stiffen the bridge." · "In **2003**, the stiffening trusses were **removed** and **aerodynamic fiberglass fairings** were installed along both sides of the road deck." ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- **⚠️ The "1943" date is the *authorisation*, not the installation.** Work was deferred for WWII, rebid in **October 1945**, and the trusses were **completed in 1947**. **Say "1947", not "1943".** The **2003 fairings** date is correct.
- Note the historical arc this illustrates: **stiffen it (1943) → streamline it (2003)** — exactly the two options Farquharson proposed in 1940.

### 6.4 How it is taught today, and the correction of the textbook story

**The correction timeline:**
- **1941** — the FWA board (Ammann, von Kármán, Woodruff) *already* rejects vortex resonance, but "without drawing any definitive conclusions"; it explored three causes: self-induced vibration, periodic eddy formation, and random turbulence. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- **1949–54** — Farquharson's UW *Bulletin 116* publishes the measurements and model results.
- **1962/63** — Franklin J. Miller's teaching film mislabels the mechanism as resonance in a caption. ([AAPT guide](https://aapt.org/Store/upload/tacoma_narrows2.pdf))
- **1991** — **Billah & Scanlan** in *AJP* state the correction for the physics community.
- **2003** — **Feldman** in *The Physics Teacher* provides the classroom version; finds "no resonance behavior in the amplitude as a function of the wind velocity."
- **2006** — **Green & Unruh** in *AJP* provide the mechanistic physical model. ([Am. J. Phys. 74(8), 706–716](https://api.crossref.org/works/10.1119/1.2201854))
- **2010s** — the **AAPT DVD user's guide** states the collapse "**was not a case of resonance**." ([Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637))
- **2022** — **Song et al.** in *JFM* reproduce both phases from one simulation. ([JFM 949, A11](https://doi.org/10.1017/jfm.2022.748))

**So the video can safely say:** *"For fifty years, physics textbooks taught that the Tacoma Narrows Bridge was a resonance demo. In 1991 two engineers published a paper saying the textbooks were wrong — and the correction took another twenty years to reach the classroom."* ✅

### 6.5 The wreckage

- Salvage ran from just after the collapse to **May 1943**. Two review boards (one federal, one state) concluded repair was impossible. Steel was sold as scrap for the war effort. **The salvage operation cost the state more than it recovered.** Exact figures from the Washington Toll Bridge Authority *Final Report* (June 1952): **return $295,726.36; removal $646,661.83; net loss $350,935.47.** (WSDOT rounds this to $350,933; **the primary figure is authoritative**.) ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- **The underwater deck now serves as a large artificial reef** and is listed on the **National Register of Historic Places, reference number 92001068**. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))
- Anchorages, tower pedestals and most of the substructure survived and were **reused** for the 1950 bridge; the towers themselves were damaged beyond repair (deflected 12 ft / 25 ft — see the conflict in §4.3) and were dismantled and recycled.
- A fragment is displayed at the **Washington State History Museum** in Tacoma; the **Harbor History Museum** has a gallery display on the 1940 bridge. ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)))

**Closing quote for the video — Othmar Ammann**, who investigated the collapse and was one of the greatest bridge engineers who ever lived:

> "…bridge engineering is not, as popularly assumed, an exact science. While ordinary structures are closely controlled by ample experience and experiments, every structure which projects into new and unexplored fields of magnitude involves new problems, for the solution of which neither theory nor practical experience can furnish an adequate guide. It is then that we must rely largely on our judgment and if as a result errors or failures occur we must accept them as a price for human progress." — [Ammann 1945, quoted in Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940))

---

## 7. Corrects-the-record / uncertainty list

### 7.1 Claims that are commonly repeated but are wrong, or too simple

| ❌ Commonly said | ✅ Better-supported version | Source |
|---|---|---|
| "It was resonance — the wind matched the bridge's natural frequency." | **Aeroelastic flutter: self-excited, negative aerodynamic damping in the torsional mode.** The wind had no periodicity; the failure frequency (0.2 Hz) was not a natural frequency of the isolated structure; amplitude grows monotonically with wind speed rather than peaking. | [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf); [MIT 18.03](https://math.mit.edu/classes/18.03/sup/sup17.pdf); [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| "Kármán vortex shedding brought it down." | **Vortex shedding explains the smaller vertical motion of the preceding months (lock-in). It did NOT drive the final torsional collapse.** The vortices in the final event were a *consequence* of the motion, not its cause. | [Billah & Scanlan 1991](http://www.ketchum.org/billah/Billah-Scanlan.pdf); [Song et al. 2022](https://doi.org/10.1017/jfm.2022.748); 1941 FWA report as quoted in [AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf) |
| "A hurricane / violent gale destroyed it." | **A moderate ~40–45 mph (64–72 km/h) wind.** The bridge was designed for 120 mph and had survived 50 mph. | [ASCE](https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/tacoma-narrows-bridges); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses) |
| "The open grating deck was the problem." | **Backwards.** The 1940 deck was a **solid plate girder** deck. **Open grating is the 1950 fix.** | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [1950 bridge](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950)) |
| "Farquharson designed the bridge." | **He was hired to fix it.** Moisseiff designed the as-built bridge; Eldridge designed the rejected original; Lienhard co-authored the theory. | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| "Frederick Lienhard designed the Tacoma bridge." | **He co-authored the elastic-distribution theory with Moisseiff (ASCE Transactions 98, 1933).** He is not the designer. | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| "It was a truss bridge that failed." | **It had no stiffening truss at all** — that was the design decision that doomed it. | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |
| "The film you have seen shows how it really moved." | **Most circulating copies run ~50% too fast** (16 fps film transferred as if 24 fps): 18 cycles/min on video vs Farquharson's stopwatch 12 cycles/min. | [Physics Today 2015](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637); [Seattle P-I](http://www.seattlepi.com/science/article/A-Tacoma-Narrows-Galloping-Gertie-bridge-6617030.php) |
| "A man died." / "Nobody was on the bridge." | **No human deaths — but several people were on the deck**, including Coatsworth, the Rapid Transfer crew, Winfield Brown, Howard Clifford and Farquharson. Injuries occurred. The only fatality was the dog Tubby. | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)); [EBSCO](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses) |
| "It collapsed within minutes of opening" / "it lasted a few weeks." | **129 days — opened 1 July 1940, collapsed 7 November 1940** ("four months"). | [ASCE](https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/tacoma-narrows-bridges) |
| "The collapse killed the concept of slender suspension bridges forever." | **Not quite:** they reverted to deep trusses, then in the **1960s** returned to slender **aerodynamic box girders** (e.g. Severn Bridge) — slenderness plus streamlining, not slenderness alone. | [Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)) |

### 7.2 Numeric disagreements between sources — do not silently pick one

| Quantity | Values found | Guidance |
|---|---|---|
| Wind at collapse | **40 mph**, **42 mph**, **40–45 mph**, **18 m/s (40.3 mph)**; WSDOT also logs **38 mph at 7:30 a.m.** | Present as "around 40–42 mph — about 65–68 km/h." Song et al.'s 18 m/s is a modern restatement, not an independent measurement. |
| Torsional twist amplitude | **±35°** (Farquharson); **~45° at quarter points** (STRUCTURE, EBSCO); **≈13 ft / >0.7 rad ≈ 40°** (Green & Unruh); **~30°** (Vice, popular). **"28°" and "38°" appear in no source** — the 28 is *feet* of edge displacement. | Use ±35° as Farquharson's measurement, note "up to ~45° at the quarter points"; never say 28° or 38°. |
| Tower height (1940) | **443 ft above water / 425 ft above piers / 230 ft above roadway** (WSDOT); **436 ft above water** (EBSCO, same quantity, different estimate) | Say "425 ft above the piers"; **never mix datums.** |
| Torsion onset time | **10:03 a.m.** (WSDOT, "gigantic by 10:07"), **~10:15** (UW Libraries), "a few minutes after 10" (Olson et al.), **10:00** (Miller film title card only) | Do **not** attribute 10:00 to WSDOT. Safest: "just after ten o'clock." |
| Tower sag after collapse | **12 ft** (WSDOT, Wikipedia) vs **25 ft** (AAPT/Farquharson only) | Use **12 ft**; the 25 ft is an unsupported outlier. |
| Deck width | **39 ft** between cables (WSDOT + AAPT + STRUCTURE), roadway **26 ft** + two **5-ft sidewalks** (WSDOT), vs **36 ft** (HAER) | Prefer 39 ft between cables / 26 ft roadway; note HAER's 36 ft. |
| Span ÷ depth | **350 : 1** (American Heritage, HAER) vs **375 : 1** (STRUCTURE) | Use 350:1; it agrees with 2800/8 = 350 exactly. |
| 1950 span ÷ depth | **85 : 1** (WSDOT prose, HAER) vs **112 : 1** (WSDOT's own Span Stats table) | Prefer **85**, which matches 2800/33 = 84.8. Flag that WSDOT contradicts itself. |
| 1950 wind grate depth | **five inches** (WTBA *Final Report*, 1952) vs **three inches** (Wikipedia) | Use **five inches**; the 33-in and 19-in widths are confirmed by both. |
| 1950 towers | **500 ft above water / 467 ft above piers** (WSDOT) vs **462 ft** (HAER) vs **502 ft** (main TNB article) vs **507 ft** (AAPT) | Genuinely inconsistent. Avoid, or say "taller by roughly 40–60 ft." |
| 1950 bridge cost | **$14,011,384.28** total as of 30 June 1952 (WTBA *Final Report*); **$11.2 M** price tag / **$13,738,000** estimate (WSDOT); **$18 million** (1950 AP) | Prefer the WTBA figure; the $18 M is an outlier. |
| 1950 bridge total length | **5,979 ft** (1940-bridge article) vs **5,400 ft** (main TNB infobox, citing Structurae) | Use 5,979 ft. |
| Deck dead load | **5,700 lb/ft** (WSDOT Span Stats + American Heritage — two independent confirmations) vs **2,850 lb/ft** (Billah & Scanlan model) | Different conventions; the 5,700 figure is the well-sourced one. |
| Insurance | **$4,000,000 plus salvage** + **$240,000** Use & Occupancy (primary) vs **$5.2 M / 80% of value** (Wikipedia) | Prefer the primary figures; flag the popular one. |
| Salvage net loss | **$350,935.47** (WTBA *Final Report*) vs **$350,933** (WSDOT) | Trivial difference; the primary figure is authoritative. |
| Vortex shedding frequency at 42 mph | Sources **state ~1 Hz**; the Strouhal formula with their own D = 8 ft, S = 0.20 gives **1.54 Hz** | **Present 1 Hz as the sources' figure; show the formula; do not compute it on screen.** |
| Duration of torsional motion | **~45 min** (Billah & Scanlan) vs **~1 hour** (Song et al.) | Either is defensible; "about three-quarters of an hour" is safest. |
| Design start date | **Sept 1938** (Wikipedia lead) vs **23 Nov 1938** (Wikipedia body/infobox + AAPT) | Use **23 Nov 1938**. |
| 1937 appropriation | **$5,000** (Wikipedia) vs **$25,000** (American Heritage) | Flag; low stakes. |

### 7.3 Things I could NOT verify — do not assert these

1. **The INSTRUMENT that measured the 42 mph wind.** The *location* is now sourced (on the bridge deck / near the east end), but **no source names an anemometer** — not WSDOT, not the 1941 FWA report, not Green & Unruh. Farquharson's documented instruments were a **surveyor's transit, reference targets and a stopwatch** — for *oscillation*, not wind. **Do not name an instrument on screen.**
2. **The copyright status of the collapse footage.** **No source declares it public domain**; no renewal or expiration record found; no US-government-work basis exists. The chain runs Camera Shop → Paramount → Castle Films → UW ("scholarly study only") → AAPT ("© 2000 AAPT"). **Clear rights before broadcast.**
3. ~~**Who "the last person on the bridge" was.**~~ **RESOLVED: Farquharson** (WSDOT Weird Fact #23; his own statement; ASCE 2023). The apparent conflict was three different records: Coatsworth = last to *drive* on; Clifford = out before Farquharson; Leach = last to cross *to the west*.
4. **"Faris" as a cameraman.** No such person appears in any source I found. The cameramen were **Barney Elliott** and **Harbine Monroe** (with some footage also by Farquharson). **Do not use "Faris."**
5. **The number of tie-down cables and the exact date they snapped.** Sources say only "shortly after installation."
6. **The "0.08 Hz" figure** for the vertical mode. I could not find it anywhere. What sources give is **8.0 cycles/min = 0.133 Hz** (fundamental vertical, AAPT Table 3) and **0.6 Hz / 36–38 cycles/min** (observed on the morning of the collapse). **Do not use 0.08 Hz.**
7. **The ≈90° heave–pitch phase difference.** Standard aeroelasticity, but no primary source retrieved. Attribute generically or omit.
8. **Arioli & Gazzola (2015) full text**, **Larsen (2000)**, and **Farquharson's Bulletin 116** — all cited here second-hand, through Billah & Scanlan, Green & Unruh, Song et al., and Physics Today.
9. **"Large-scale vortices alternately above and below the deck"** as a quotation from Green & Unruh. **Not verbatim** — it is a fair paraphrase of their abstract. Paraphrase, don't quote.
10. **The insurance-agent anecdote** ($70,000 premium pocketed, two years in jail) — single popular source.
11. **PBS/NOVA's *Building Big* Tacoma page** — could not be retrieved on any route. Wikipedia cites it for the 39-ft width, but I verified that figure from WSDOT instead. **Do not cite NOVA.**
12. **"200 different configurations" and "±45° yaw"** for the 1950 wind-tunnel programme — **single-sourced** to a WSDOT page. Suggestive, not corroborated. Attribute it ("according to WSDOT") or drop it.
13. **Byline caution for the 16 fps discovery.** The 2015 coverage bylines are **Jake Ellison** (Seattle Post-Intelligencer) and **Evan Bush** (Seattle Times) — **not Erik Lacitis.** The underlying research is by **Donald W. Olson, Steven F. Wolf, Joseph M. Hook** (Texas State University; *Physics Today* 68(11), 64–65) with **Russell Doescher** (*The Physics Teacher* 53(8), 461–465). The *Wikipedia* article's Seattle P-I link does not match the byline in circulation — verify before citing a name on screen.
14. **WSDOT's "1:112" span-to-depth figure for the 1950 bridge** in its own Span Stats table, which contradicts its prose "1:85" and the arithmetic (2800/33 = 84.8). Treat as an error in the source.

### 7.4 Fact-check notes on the brief itself (correct these if they appear in the script)

- **Green & Unruh (2006) is *Am. J. Phys.* 74(8), 706–716** — *not* "74, 506." doi 10.1119/1.2201854. ✅ [Crossref](https://api.crossref.org/works/10.1119/1.2201854)
- **The Journal of Fluid Mechanics paper is Song, Kim, Kwon & Choi, *JFM* 949, A11 (2022)** — *not* a 2024 Arioli & Gazzola paper, and *not* A27. doi 10.1017/jfm.2022.748. ✅ [Crossref](https://api.crossref.org/works/10.1017/jfm.2022.748)
- **"Farquharson and his students built a 1:200 model"** — correct for the *original* bridge ([Wikipedia](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940))); for the *replacement* he used a dynamic **1:50** model ([AAPT](https://aapt.org/Store/upload/tacoma_narrows2.pdf)).

---

## 8. Chinese-language glossary for the script

| English | 中文建议 | Note |
|---|---|---|
| aeroelastic flutter | 气动弹性颤振 / 颤振 | the central term |
| self-excited oscillation | 自激振动 | emphasise 自 (self) |
| negative aerodynamic damping | 负气动阻尼 | explain as "助推而不是刹车" |
| forced vibration | 受迫振动 | |
| resonance | 共振 | the term to *correct*, not to use as the cause |
| heave / vertical bending | 竖向弯曲 / 升沉 | |
| torsion / twisting | 扭转 | |
| torsional degree of freedom | 扭转自由度 | |
| Kármán vortex street | 卡门涡街 | |
| vortex shedding | 涡脱落 / 涡激 | |
| vortex-induced vibration | 涡激振动 | |
| lock-in | 锁定（涡激锁定） | used for the *early* vertical motion |
| critical flutter speed | 颤振临界风速 | |
| bluff body | 钝体 | |
| separated flow | 分离流 | |
| angle of attack | 攻角 | |
| plate girder | 钢板梁 | 1940 deck |
| stiffening truss | 加劲桁架 | 1950 deck |
| open grating deck | 开孔/格栅桥面 | the later fix |
| slenderness ratio | 长细比 / 跨深比 | |
| damping measure | 减振措施 | |
| wind tunnel test | 风洞试验 | |
| suspension bridge | 悬索桥 | |
| main span | 主跨 | |
| stiffening girder | 加劲梁 | |

---

## 9. Master source list

**Primary and near-primary**
- **Washington State Department of Transportation, *Tacoma Narrows Bridge History*** — [1940 bridge "The Machine" (Span Stats)](https://www.wsdot.wa.gov/TNBhistory/1940-bridge.htm) · [collapse page](https://www.wsdot.wa.gov/TNBhistory/collapse.htm) · [Weird Facts](https://www.wsdot.wa.gov/TNBHistory/weird-facts.htm) · [Tubby trivia](https://www.wsdot.wa.gov/TNBHistory/tubby-trivia.htm) · [bridge timeline](https://www.wsdot.wa.gov/TNBhistory/bridge-timeline.htm) · [eyewitnesses](https://www.wsdot.wa.gov/tnbhistory/eyewitnesses.htm) — **the official state history; the source for the 425/443-ft tower data, 26-ft roadway, 5,700 lb/ft deck weight, the May 1940 nickname origin, and the "last man on the bridge" ranking**
- **Washington Toll Bridge Authority, *Final Report* (Charles E. Andrew, June 1952)** — the primary accounting for the 1950 bridge: total cost **$14,011,384.28**, five-inch open floor grating, salvage figures to the cent
- **Federal Works Agency, *The Failure of the Tacoma Narrows Bridge* (Ammann, von Kármán & Woodruff, 28 March 1941)** — [HathiTrust copy](https://babel.hathitrust.org/cgi/ssd?id=mdp.39015021064251) — the original inquiry report; rejects vortex resonance
- [K. Y. Billah & R. H. Scanlan, "Resonance, Tacoma Narrows bridge failure, and undergraduate physics textbooks," *Am. J. Phys.* 59(2), 118–124 (1991)](http://www.ketchum.org/billah/Billah-Scanlan.pdf) · doi [10.1119/1.16590](https://doi.org/10.1119/1.16590)
- [O. H. Ammann, "Present Status of Design of Suspension Bridges with Respect to Dynamic Wind Action," *J. Boston Soc. Civil Engineers* 40(3), July 1953, 231–243](https://www.bscesjournal.org/wp-content/uploads/Vol-40_No-3_July-1953.pdf)
- [AAPT / Fuller, Zollman & Campbell, *Twin Views of the Tacoma Narrows Bridge Collapse* (teacher's guide + Franklin Miller film synopsis)](https://aapt.org/Store/upload/tacoma_narrows2.pdf) — quotes the 1941 FWA report, Farquharson's statements, and Billah & Scanlan
- [D. Green & W. G. Unruh, "The failure of the Tacoma Bridge: A physical model," *Am. J. Phys.* 74(8), 706–716 (2006)](https://api.crossref.org/works/10.1119/1.2201854)
- [D. Song, W. Kim, O.-K. Kwon & H. Choi, "Vertical and torsional vibrations before the collapse of the Tacoma Narrows Bridge in 1940," *J. Fluid Mech.* 949, A11 (2022)](https://doi.org/10.1017/jfm.2022.748)
- [G. Arioli & F. Gazzola, "A new mathematical explanation of what triggered the catastrophic torsional mode of the Tacoma Narrows Bridge," *Appl. Math. Modelling* 39(2), 901–912 (2015)](https://doi.org/10.1016/j.apm.2014.06.022)
- [D. W. Olson, S. F. Wolf & J. M. Hook, "The Tacoma Narrows Bridge collapse," *Physics Today* 68(11), 64–65 (2015)](https://physicstoday.aip.org/quick-study/the-tacoma-narrows-bridge-collapse-1760014552637)
- [MIT 18.03 Differential Equations, supplement §17, "The Tacoma Narrows bridge"](https://math.mit.edu/classes/18.03/sup/sup17.pdf)
- [A. Jenkins, "Self-oscillation," arXiv:1109.6640](https://arxiv.org/html/1109.6640v1)
- F. B. Farquharson et al., *Aerodynamic Stability of Suspension Bridges with Special Reference to the Tacoma Narrows Bridge*, Univ. of Washington Engineering Experiment Station Bulletin 116, Parts I–V, 1949–1954 — [catalogue record](https://searchworks.stanford.edu/view/4402604) *(print only; not retrieved)*

**Institutional / reference**
- [Wikipedia, "Tacoma Narrows Bridge (1940)"](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940))
- [Wikipedia, "Tacoma Narrows Bridge (1950)"](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1950))
- [Wikipedia, "Tacoma Narrows Bridge"](https://en.wikipedia.org/wiki/Tacoma_Narrows_Bridge)
- [Wikipedia, "Aeroelasticity"](https://en.wikipedia.org/wiki/Aeroelasticity)
- [ASCE Historic Landmark: Tacoma Narrows Bridges](https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/tacoma-narrows-bridges)
- [EBSCO Research Starter: "Tacoma Narrows Bridge Collapses"](https://www.ebsco.com/research-starters/history/tacoma-narrows-bridge-collapses)
- [STRUCTURE magazine, S. Cheruku, "Revisiting the Galloping Gertie"](https://www.structuremagazine.org/article/revisiting-the-galloping-gertie/)
- [Old Structures Engineering, D. Friedman, "Significant Differences" (HAER data summary)](https://oldstructures.com/2022/04/06/significant-differences/)
- [American Heritage, J. S. Gordon, "Tacoma Narrows Bridge Is Falling Down"](https://www.americanheritage.com/content/tacoma-narrows-bridge-falling-down)
- [University of Washington Libraries, Tacoma Narrows Bridge exhibit](https://www.lib.washington.edu/specialcollections/collections/exhibits/tnb)
- [UW Tacoma Narrows Bridge Film Collection](https://content.lib.washington.edu/filmarchweb/tacoma.html)
- [Library of Congress, complete National Film Registry list](https://www.loc.gov/programs/national-film-preservation-board/film-registry/complete-national-film-registry-listing/)
- [Vice, A. Pasternack, "The Strangest, Most Spectacular Bridge Collapse (And How We Got It Wrong)" (2015)](https://www.vice.com/en/article/the-myth-of-galloping-gertie/) — *popular source; verify numbers*
- [Seattle Post-Intelligencer, 7 Nov 2015, on the 16 fps film-speed discovery](http://www.seattlepi.com/science/article/A-Tacoma-Narrows-Galloping-Gertie-bridge-6617030.php)

---

*Companion file: `research/tacoma-narrows-physics-factpack.md` — a much longer, fully-quoted treatment of Section 5 (the physics), including verbatim passages from Billah & Scanlan (1991), Green & Unruh (2006), Song et al. (2022), Ammann (1953) and MIT 18.03, plus a verification log.*
