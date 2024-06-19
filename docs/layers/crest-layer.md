# Crest layer

Il crest layer è responsabile della visualizzazione 3D del traffico, può essere sia statico che animato.

## Parametri

I parametri iniziali sono questi:

````
getStartPosition: {
    type: "attribute",
    value: (d) => d.startPosition,
},
getMiddlePosition: { // deprecato
    type: "attribute",
    value: (d) => d.middlePosition,
},
getEndPosition: {
    type: "attribute",
    value: (d) => d.endPosition,
},
getStartDensity: {
    type: "attribute",
    value: (d) => d.startDensity,
},
getMiddleDensity: {
    type: "attribute",
    value: (d) => d.middleDensity,
},
getEndDensity: {
    type: "attribute",
    value: (d) => d.endDensity,
},
getStartColor: {
    type: "attribute",
    value: (d) => d.startColor.map((x) => x / 255),
},
getMiddleColor: {
    type: "attribute",
    value: (d) => d.middleColor.map((x) => x / 255),
},
getEndColor: {
    type: "attribute",
    value: (d) => d.endColor.map((x) => x / 255),
},
getIndex: {
    type: "attribute",
    value: (d) => d.index,
},
currentTime: {
    type: "float",
    value: 0,
},
isAnimated: {
    type: "bool",
    value: true
},
arrowSize: {
    type: "float",
    value: 30
},
minHeight: {
    type: "float",
    value: 5
},
maxHeight: {
    type: "float",
    value: 40
}
````

 - getStartPosition: posizione iniziale del segmento.
 - getMiddlePosition: posizione centrale del segmento. (deprecato)
 - getEndPosition: posizione finale del segmento.
 - getStartDensity: densità iniziale del segmento.
 - getMiddleDensity: densità del segmento.
 - getEndDensity: densità finale del segmento.
 - getStartColor: colore iniziale del segmento.
 - getMiddleColor: colore del segmento.
 - getEndColor: colore finale del segmento.
 - getIndex: deprecato.
 - currentTime: tempo con qui si anima il layer. (deve essere incrementale)
 - isAnimated: impostare a true se si vuole la versione animata del layer.
 - arrowSize: dimenzioni in metri della freccia nel caso in cui isAnimated sia impostato a true.
 - minHeight: altezza minima del segmento.
 - maxHeight: altezza massima del segmento.

Imaginando un caso di esempio composto da cinque segmenti, i parametri da impostare saranno cosi dati:

 \              /
  \            /
   \__________/
   /A        B\
  /            \
 /              \

getStartPosition: sarà il le coordinate del punto A.
getEndPosition: sarà le coordinate del punto B.
getStartDensity: la media dei segmenti collegati ad A e il segmento stesso.
getMiddleDensity: la densità del segmento.
getEndDensity: la media dei segmenti collegati ad B e il segmento stesso.
getStartColor: il colore che deve essere applicato alla densità iniziale.
getMiddleColor: il colore che deve essere applicato alla densità del segmento.
getEndColor: il colore che deve essere applicato alla densità finale.
