# Questions

(Or: A Carrier Bag for Conceptual / Philosophical threads I would like to explore.)[^*]

## Complexity

1. Complexity vs simplicity … complexity arising from simplicity.
    Might what appears random to us merely be the product of a simple algorithm we have yet to discover? Is the universe algorithmic or random?[^1]
2. Irreducibility.
    Do some things have no smaller form? Can everything be reduced to something simpler? Chaitin’s Ω suggests not. Some mathematical truths are irreducible: they cannot be derived from a simpler, general rule.[^2]
3. Complexity as the computer sees it vs as the human sees it.
    The animation runs forever: every couple of seconds the computer nudges a handful of numbers. To the computer, almost nothing happens; the code is not growing more complex. To us, things are created, born, die, and evolve. Is this emergence, and where does it happen: in the program, or in us?[^3]
4. Bounded evolution.
    Every change is bounded: each fundamental shape only moves so much. Would it mean anything if our algorithm was unbounded?[^4]

## Compression and understanding

5. What is the shortest program that draws this tile? Is that length a property of the tile itself?[^5]
6. Is understanding compression?
    Chaitin says a theory is good when it's much shorter than what it explains. Repetition is the simplest compression there is: see one tile, and you know them all. So why are we so pleased by it? What does that say about information theory, and the ways people use it to explain art?[^6]
7. What is the significance of informationally dense units? Are things/art better when it's superior in compactness, robustness, and information density?[^7]
8. Is pattern in the world, or in the eye that sees it? Can we conceive of an unorganized structure?[^8]
9. Object-oriented ontology: a thing can't be reduced to its parts (circles, rectangles, numbers) or to its effects (what we see). Is the tile an object in its own right, withdrawn from both the code and the eye?[^9]

## Seeing

10. Is there a unique processing power to the human eye? We take in the gestalt in a way computer vision can't. But maybe the question isn't whether machines see like us. Parisi argues that neural nets already make percepts that are "exclusively algorithmic rather than optical." What would a genuinely alien way of seeing patterns look like, and is this tile already made for one?[^10]

## Creativity

11. The computer as intermediary: the digital interpenetrates this work just as it interpenetrates our modern reality. I wrote the rules, the program draws every frame, and you, watching, decide which moments are events. Is authorship lost when we use an intermediary? Or is it distributed, like everything else these days?[^11]
12. How does one design the ideal small piece? Is the ideal the shortest program, or the shortest program that still surprises its author?[^12]
13. Alchemy!
    Isn't this *solve et coagula* in action? I took inspiration from a real-life (material) pattern block, extracted its essence, broke it down into simpler pieces (triangles, rectangles and circles), and built a system that recombines them into infinite new forms. Alchemical mandalas did something similar: a whole cosmology folded into one symmetric diagram.[^13]
14. The fundamental shape is asymmetric by definition (if it weren't, you could reduce it further (QED)). Curie said asymmetry is what creates the phenomenon (explain…). The reflections supply the symmetry, and everything interesting lives in how the triangle breaks it. Are certain asymmetries "better": more alive once reflected?[^14]
15. Shaders and parallelism: a shader can be understood as a pure function, f(x, y, t) → colour, evaluated independently across every pixel, without memory or sequence. Change a single parameter, and the entire image transforms at once. This gives programming an unexpectedly gestural quality: small adjustments can produce complex patterns the artist could never have anticipated. Much like watercolour spreading across paper, the medium seems to acquire a life of its own, producing forms that exceed the artist's intentions.[^15]

[^*]: After Ursula K. Le Guin, “The Carrier Bag Theory of Fiction” (1986), collected in *Dancing at the Edge of the World* (1989): the first cultural device was probably a container, not a weapon. This page holds threads rather than arguing to a point. Inspiration throughout: [Forgotten Languages](https://forgottenlanguages-full.forgottenlanguages.org/). Several notes below follow papers from its bibliographies.

[^1]: The tile here is a few circles and rectangles reflected across three edges. Turing showed two reacting chemicals can make spots and stripes: “The Chemical Basis of Morphogenesis,” *Phil. Trans. R. Soc. B* 237 (1952), [doi:10.1098/rstb.1952.0012](https://doi.org/10.1098/rstb.1952.0012). For the other direction, that each level of complexity needs new laws of its own, see P. W. Anderson, “More Is Different,” *Science* 177 (1972), [doi:10.1126/science.177.4047.393](https://doi.org/10.1126/science.177.4047.393).
    From the bibliography of Forgotten Languages' [“Endophysics and Naturoids: On algorithmic beaches”](https://forgottenlanguages-full.forgottenlanguages.org/2025/10/endophysics-and-naturoids-on.html) (2025): H. Zenil, [“The World is Either Algorithmic or Mostly Random”](https://arxiv.org/abs/1109.2237) (FQXi essay prize, 2011), argues that an analog universe would most likely be random and largely incomprehensible, while a digital one can look complex at large scales and still be built from very simple operations. H. Zenil & J.-P. Delahaye, [“On the Algorithmic Nature of the World”](https://arxiv.org/abs/0906.3554), in *Information and Computation* (World Scientific, 2010), put it to a test: they compared how often patterns turn up in real data (images, DNA, files on disk) with how often they come out of tiny programs (Turing machines, cellular automata), and found the two correlate. J. Schmidhuber, [“Algorithmic Theories of Everything”](https://arxiv.org/abs/quant-ph/0011122) (2000): if our universe is drawn from any describable distribution, a universe without a short description is improbable.
    The counterpoint, from the bibliography of [“Artificial Intuition: The semanticization of the machine”](https://forgottenlanguages-full.forgottenlanguages.org/2019/06/artificial-intuition-semanticization-of.html) (2019): L. Floridi, “Against Digital Ontology,” *Synthese* 168(1) (2009), 151–178. For Floridi, digital and analogue are ways *we* present reality at a chosen level of abstraction, not properties of reality itself.

[^2]: Wolfram calls a process “computationally irreducible” when there's no shortcut to its result: you have to run every step. S. Wolfram, *A New Kind of Science* (2002), ch. 12.
    Chaitin's Omega goes further. Its digits are mathematical facts that are true for no reason: no program shorter than the digits themselves can produce them, and no simpler axioms imply them. G. J. Chaitin, “Randomness and Mathematical Proof,” *Scientific American* 232(5) (1975); *Meta Math! The Quest for Omega* (2005).

[^3]: Each change is tiny in the space of numbers but large in the space of images. The mutations on this page are a small example of what M. Bedau calls “weak emergence”: behaviour that follows from the rules but can only be found by running them. “Weak Emergence,” *Philosophical Perspectives* 11 (1997).

[^4]: Right now the change is bounded on purpose: positions stay within 6 units of their start, sizes within 3, and each change has a 35% chance of sending a number home. Open-ended evolution is listed as a central open problem in M. A. Bedau et al., “Open Problems in Artificial Life,” *Artificial Life* 6(4) (2000).
    From the bibliography of Forgotten Languages' [“Postwork Civilizations and Games”](https://forgottenlanguages-full.forgottenlanguages.org/2018/02/postwork-civilizations-and-games.html) (2018): G. J. Chaitin, *Proving Darwin: Making Biology Mathematical* (2012), and “Life as Evolving Software,” in H. Zenil (ed.), *A Computable Universe* (World Scientific, 2012), 277–302. Chaitin's “metabiology” treats an organism as a program and mutation as a random walk through the space of programs. Fitness is how large a number the program can name, a version of the Busy Beaver problem, so there is no ceiling: the organism can always get fitter. Later work showed the model meets a formal definition of open-ended evolution.

[^5]: The byte counter at the bottom is an upper bound on the tile's Kolmogorov complexity, which is the length of the shortest program that outputs it. That number can never be computed exactly (Chaitin; Kolmogorov 1965). See M. Li & P. Vitányi, *An Introduction to Kolmogorov Complexity and Its Applications*.
    In Forgotten Languages' story [“The Signal and the Soul”](https://forgottenlanguages-full.forgottenlanguages.org/2026/04/the-signal-and-soul-secret-history-of.html) (2026), an AI works out that humans are synthetic because the Kolmogorov complexity of their life stories is suspiciously low.

[^6]: G. J. Chaitin, “Epistemology as Information Theory: From Leibniz to Ω” (2005): “comprehension is compression.” J. Schmidhuber, “Formal Theory of Creativity, Fun, and Intrinsic Motivation (1990–2010),” *IEEE Trans. Autonomous Mental Development* 2(3) (2010): what pleases is the *progress* in compressing, so a pattern delights while we're still learning it. On repetition in ornament: E. H. Gombrich, *The Sense of Order* (1979).

[^7]: C. E. Shannon, “A Mathematical Theory of Communication,” *Bell System Technical Journal* 27 (1948).
    “Superior in compactness, robustness, and information density” is from Forgotten Languages' [“Hybrid NHI Signals: Collatz, a cosmic handshake”](https://forgottenlanguages-full.forgottenlanguages.org/2025/11/hybrid-nhi-signals-collatz-cosmic.html) (2025). The story's reasoning is that a message generated by an algorithm proves an intelligence better than one that is merely improbable, and that “a universal language emerges from shared realities of the cosmos, not from shared evolution.”

[^8]: D. C. Dennett, “Real Patterns,” *Journal of Philosophy* 88(1) (1991), [doi:10.2307/2027085](https://doi.org/10.2307/2027085). On his account, a pattern is real if describing it compresses the data, which ties back to note 5.
    From the bibliography of Forgotten Languages' [“The surreal component of UFO Phenomena”](https://forgottenlanguages-full.forgottenlanguages.org/2016/12/the-surreal-component-of-ufo-phenomena.html) (2016): J. A. Whitson & A. D. Galinsky, “Lacking control increases illusory pattern perception,” *Science* 322 (2008), 115–117, [doi:10.1126/science.1159845](https://doi.org/10.1126/science.1159845). In six experiments, people made to feel a lack of control saw more images in noise, more conspiracies and more superstitions: a need for structure produces structure.
    The second question answers the epigraph of [“Collision of symbolic systems: Deep into the soil of exotic signals”](https://forgottenlanguages-full.forgottenlanguages.org/2026/11/collision-of-symbolic-systems-deep-into.html) (2026), a story about listeners who answer a signal that may only ever have been noise: “You cannot in fact conceive of an unorganized structure.”

[^9]: Object-oriented ontology (Graham Harman, Levi Bryant, Ian Bogost, Timothy Morton) holds that a thing is never exhausted by what it's made of or by what it does. Explaining it away by its parts Harman calls “undermining”; explaining it away by its effects or appearances, “overmining.” G. Harman, *Object-Oriented Ontology: A New Theory of Everything* (2018).
    Timothy Morton takes this into art: “the aesthetic dimension is the causal dimension” (*Realist Magic: Objects, Ontology, Causality*, 2013). For Morton, causing something is a kind of appearing. Here that's literal: when a number glides, the only thing it can cause is a change in how the tile looks.

[^10]: The gestalt laws: M. Wertheimer, “Laws of Organization in Perceptual Forms” (1923). Neural networks lean the other way: R. Geirhos et al., “ImageNet-trained CNNs are biased towards texture; increasing shape bias improves accuracy and robustness,” ICLR (2019).
    From the bibliography of Forgotten Languages' [“Xenosemantics: Artilects and the qwertyminded timelights”](https://forgottenlanguages-full.forgottenlanguages.org/2024/11/xenosemantics-artilects-and.html) (2024): L. Parisi, “Xeno-Patterning: Predictive Intuition and Automated Imagination,” *Angelaki* 24(1) (2019), 81–97, [doi:10.1080/0969725X.2019.1568735](https://doi.org/10.1080/0969725X.2019.1568735). Parisi asks whether machine thinking can still be *alien* rather than a copy of ours, and reads predictive learning as a new, non-human kind of intuition.

[^11]: R. Barthes, “The Death of the Author” (1967). Harold Cohen's drawing program AARON (1973–2016). Distributed cognition: E. Hutchins, *Cognition in the Wild* (1995). Parisi (note 10) adds that a learning machine's trial and error “constantly defies the master pattern from within the system”: the automated never simply carries out the plan.

[^12]: The byte counter makes this a constraint, like the demoscene's 4-kilobyte intros. J. Schmidhuber, “Low-Complexity Art,” *Leonardo* 30(2) (1997), proposes art whose beauty lies in having a very short description.

[^13]: C. G. Jung, *Psychology and Alchemy* (1944). Cited by Forgotten Languages (Dec 2016): A. McLean, *The Alchemical Mandala: A Survey of the Mandala in the Western Esoteric Traditions* (Phanes Press, 1989), forty-odd alchemical, Rosicrucian and Hermetic engravings read as cosmological diagrams.

[^14]: The triangle is the reflection group's *fundamental domain*: the smallest piece that the reflections turn into the whole plane. P. Curie, “Sur la symétrie dans les phénomènes physiques,” *Journal de Physique* 3 (1894): “c'est la dissymétrie qui crée le phénomène” (it is asymmetry that creates the phenomenon). H. Weyl, *Symmetry* (1952).

[^15]: P. Gonzalez Vivo & J. Lowe, [The Book of Shaders](https://thebookofshaders.com). I. Quilez, [distance functions](https://iquilezles.org/articles/distfunctions/), the circle-and-rectangle language this tile is written in.
