# Building fusion tile layer

Layer composite utilizzato per la visualizzazione degli edifici con l'utilizzo del Fusion Layer.
Questa classe utilizza i workers per paralizzare il processo del elaborazione dello scenegraph.

## Funzioni

- getTiledBuildingData: data una tile viene suddivisa in multiple tile di zoom 16 e viene scaricato lo scenegraph relativo, per ogni tile viene utilizzato un worker.
- renderSubLayers: funzione che renderizza il layer per il tile corrispondente in questo caso e' di tipo buildingFusionLayer, se in modalita' debug vengono mostrati altri due layer, uno per il contorno del layer e un altro per il testo.
- updateTileNumber: funzione che restituisce tutti i dati numerici del layer.
- renderLayers: funzione standard che restituisce il fusionTileLayer in cui alcune funzioni vengono bindate alla classe corrente.