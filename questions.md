# Questions

A carrier bag for questions this tile brought up.[^*] I started with a physical pattern block and rebuilt its design from circles, rectangles and triangles. The shader reflects one triangular piece to make a repeating pattern. Every few seconds, a handful of numbers change and the pattern shifts.

## Complexity and simplicity

1. How much complexity can a few simple shapes and rules produce?[^1]
    When the tile looks random, how would we tell whether we just haven’t worked out its rules?
2. Can every sequence be compressed? The opening bits of Chaitin’s Ω resist substantial compression.[^2]
3. A few numbers shift and I see a new shape. Where does that sense of novelty come from?[^3]
4. Each shape can change only so much before it returns to familiar territory. What would it take for the pattern to keep changing in ways I couldn’t foresee?[^4]

## Compression and understanding

5. How short could a program get and still draw this exact frame at this resolution?[^5]
6. Did I understand the pattern because I was able to compress it?[^6]
    Once I can predict what repeats, why does looking at it still give me pleasure?
7. How much of the tile can change before I stop recognising it? Does repetition make the pattern easier to recognise as it changes?[^7]
8. When I find a shorter way to describe an image, how do I know I’ve found a pattern in it? Can we conceive of an unorganised structure?[^8]

## Object-oriented ontology

9. Graham Harman argues that a thing exceeds what it’s made of and what it does. If the tile is an object in its own right, what about it escapes both the code and the eye?[^9]

## Seeing

10. What might a machine pick out in this tile that I miss?[^10]
    Luciana Parisi asks whether predictive systems can develop ways of perceiving that differ from our own. What would it take for me to recognise a pattern that a machine finds?

## Creativity

11. I wrote the rules, the program draws every frame, and you, watching, decide which moments are events. Where does that leave authorship?[^11]
12. When I’m trying to make a small piece, what am I after? The shortest program, or the shortest one that still surprises me?[^12]
13. The reflections give the tiling its symmetry. Which details inside the triangle come alive when they’re reflected?[^14]

## Shaders and gesture

14. How much can a small gesture change?[^15]
    The shader computes each pixel’s colour from its position, the time and the current settings. Nudge one number and the whole pattern can change. It reminds me of watercolour spreading across paper. I make a small adjustment, then watch what it does.

## Alchemy

15. Is this *solve et coagula* in action?[^13]
    I took a physical pattern apart and wrote rules for putting it back together. The pieces keep recombining into new variations. I think of alchemical mandalas, with a whole cosmology folded into one symmetric diagram.

[^*]: In “The Carrier Bag Theory of Fiction” (1986), Ursula K. Le Guin takes up Elizabeth Fisher’s idea that the first cultural device was a container. This page holds questions I’m still carrying. Several references came through the bibliographies of Forgotten Languages. [Le Guin’s essay](https://www.ursulakleguin.com/the-carrier-bag-theory-of-fiction) · [Forgotten Languages](https://forgottenlanguages-full.forgottenlanguages.org/)

[^1]: Alan Turing showed how chemicals reacting and diffusing could produce spatial patterns. P. W. Anderson asks what new principles become necessary at larger scales. Hector Zenil and Luciano Floridi explore the appeal and limits of an algorithmic account of nature. [Turing, “The Chemical Basis of Morphogenesis”](https://doi.org/10.1098/rstb.1952.0012) · [Anderson, “More Is Different”](https://doi.org/10.1126/science.177.4047.393) · [Zenil, “The World Is Either Algorithmic or Mostly Random”](https://arxiv.org/abs/1109.2237) · [Floridi, “Against Digital Ontology”](https://doi.org/10.1007/s11229-008-9334-6)

[^2]: Fix a universal prefix-free machine and take the first *n* binary digits of its halting probability Ω. The shortest program that produces those digits can save at most a fixed number of bits, however many digits you take. Stephen Wolfram’s discussion of computational irreducibility raises a related question about how long it takes to compute a result. See *A New Kind of Science* (2002), ch. 12. [Chaitin, “Epistemology as Information Theory”](https://arxiv.org/abs/math/0506552)

[^3]: About every two seconds the animation nudges a few numbers, and the change can be much easier to see in the image than in the code. Mark Bedau’s “Weak Emergence” (1997) asks when behaviour that follows from a system’s rules can be derived only by simulating them.

[^4]: The animation bounds changes to shape position and size, and a mutation can reset a value to its starting point. For open-ended evolution, see Mark Bedau et al., “Open Problems in Artificial Life” (2000), and Gregory Chaitin, *Proving Darwin* (2012), which models evolution as a search through programs that produce progressively larger numbers. [Forgotten Languages, “Postwork Civilizations and Games”](https://forgottenlanguages-full.forgottenlanguages.org/2018/02/postwork-civilizations-and-games.html)

[^5]: The counter measures the bytes in the displayed shader source. With its renderer and fixed inputs, the shader gives one recipe for a particular frame. Kolmogorov complexity gives the length of the shortest program that produces a specified output in a given computational model. There is no general algorithm that finds that length for every output. See Ming Li and Paul Vitányi, *An Introduction to Kolmogorov Complexity and Its Applications*. Forgotten Languages turns the idea into fiction through an AI that finds human life stories suspiciously easy to compress. [“The Signal and the Soul”](https://forgottenlanguages-full.forgottenlanguages.org/2026/04/the-signal-and-soul-secret-history-of.html)

[^6]: Chaitin describes comprehension as compression. Jürgen Schmidhuber proposes that pleasure comes from improvements in our ability to compress what we encounter. For repetition in ornament, see E. H. Gombrich, *The Sense of Order* (1979). [Chaitin, “Epistemology as Information Theory”](https://arxiv.org/abs/math/0506552) · [Schmidhuber, “Formal Theory of Creativity, Fun, and Intrinsic Motivation”](https://arxiv.org/abs/0812.4360)

[^7]: Claude Shannon’s “A Mathematical Theory of Communication” (1948) explores how repetition and other kinds of redundancy can help a message survive noise. A Forgotten Languages story imagines an algorithmically generated message as evidence of intelligence. [“Hybrid NHI Signals: Collatz, a cosmic handshake”](https://forgottenlanguages-full.forgottenlanguages.org/2025/11/hybrid-nhi-signals-collatz-cosmic.html)

[^8]: Daniel Dennett connects a pattern’s reality to what it lets us compress. Jennifer Whitson and Adam Galinsky found that inducing a sense of low control made participants more likely to perceive patterns in noise. The question about unorganised structure comes from the epigraph to “Collision of symbolic systems.” [Dennett, “Real Patterns”](https://doi.org/10.2307/2027085) · [Whitson and Galinsky, “Lacking Control Increases Illusory Pattern Perception”](https://doi.org/10.1126/science.1159845) · [Forgotten Languages, “Collision of symbolic systems”](https://forgottenlanguages-full.forgottenlanguages.org/2026/11/collision-of-symbolic-systems-deep-into.html)

[^9]: See Graham Harman, *Object-Oriented Ontology: A New Theory of Everything* (2018). Harman calls explaining a thing entirely through its parts *undermining* and explaining it entirely through its effects or appearances *overmining*. Timothy Morton takes these questions into art and causation in *Realist Magic* (2013).

[^10]: Luciana Parisi considers what kinds of perception and imagination emerge through predictive learning. Robert Geirhos and colleagues compared how particular computer vision models and people use texture and shape. [Parisi, “Xeno-Patterning”](https://doi.org/10.1080/0969725X.2019.1568735) · [Geirhos et al.](https://arxiv.org/abs/1811.12231) · [Forgotten Languages, “Xenosemantics”](https://forgottenlanguages-full.forgottenlanguages.org/2024/11/xenosemantics-artilects-and.html)

[^11]: Roland Barthes, “The Death of the Author” (1967), Harold Cohen’s drawing program AARON, and Edwin Hutchins, *Cognition in the Wild* (1995), offer different ways to think about how the making and meaning of a work are shared.

[^12]: The byte counter reminds me of the demoscene’s 4-kilobyte intros. Jürgen Schmidhuber’s “Low-Complexity Art” (1997) considers how much an artwork can do with a short description.

[^13]: *Solve et coagula* means “dissolve and re-form.” See C. G. Jung, *Psychology and Alchemy* (1944), and Adam McLean, *The Alchemical Mandala* (1989), on alchemical, Rosicrucian and Hermetic diagrams.

[^14]: The triangle is a *fundamental domain*. Repeatedly reflecting it across its sides generates the tiling. Pierre Curie used the phrase “c’est la dissymétrie qui crée le phénomène” when discussing the absence of certain symmetries in physical phenomena. I’m borrowing that idea to think about what the reflections bring out in the tile. See also Hermann Weyl, *Symmetry* (1952). [Curie’s 1894 paper](https://zenodo.org/records/1429784)

[^15]: Patricio Gonzalez Vivo and Jen Lowe introduce drawing with fragment shaders. Iñigo Quilez describes the distance functions used to make shapes like the ones in the tile. [*The Book of Shaders*](https://thebookofshaders.com/) · [“2D distance functions”](https://iquilezles.org/articles/distfunctions2d/)
