# Snap4Deck

Il codice sorgente è completamente contenuto su ./src con la seguente struttura.

- core: qui si trova il codice con funzioni e classi per la geometria 3D.
- factories: cartella con sole funzioni per la creazione veloce di layer tipici in snap4city.
- layers: cartella contenente tutti i layer personalizzati.
- utils: funzioni helper per la libreria.
- main.js: script per il boundle per webpack.js.

Ogni cartella ha a sua volta un file boundle.js dove vengono definite le funzioni e classi da esportare per poter essere richiamato all esterno della libreria.