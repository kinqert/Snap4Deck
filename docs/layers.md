# Layers

Qui vengono definiti tutti il layer.

# Panoramica

Panoramica dei layers definiti.

| LAYER | TIPOLOGIA | SCOPO |
|---|---|---|
|cached-glb-layer | derivato | estende il GLBLayer dove vengono applicati materiali di default.
| crest-layer | base | crea un layer per la visualizzazione del traffico in 3D con un sistema a creste, dove il colore.
| glb-tile-layer | derivato | deriva dal TileLayer dove vengono applicate delle ottimizazione per il rendering di file GLB.
| managed-tile-layer | derivato | simile al glb-tile-layer.
| sensor-3D-layer | composto | layer per la costruzione di pillar per la visualizzazione dei sensori e del loro relativo valore.
| managed-terrain-layer | derivato | estenzione del TerrainLayer con varie ottimizzazioni e il supporto di heatmap e traffic texture blending.
| terrain-mesh-layer | derivato | deriva da ScenegraphLayer e implementa il blending delle texture.
| tree-layer | composto | layer per la visualizzazione di alberi.

### Tipologie:
- base: layer creato da zero dove ogni aspetto e definito all interno della classe.
- derivato: layer che deriva da un altro dove ci saranno solo delle minime modifiche al comportamento originale.
- Composto: layer che contiene al suo interno altri layers.