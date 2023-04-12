# Drupal Image Style Generator
Drupal Image Style Generator

Allows to generate drupal image styles, based on the `theme.breakpoints.yml` in the theme.


configure the width and spect ratio of styles per breakpoint: .xs .sm .md .lg .xl

```
imageStyles:
  header_location:
    label: 'Header Standort'
    aspectRatio: 0.59
    width: 545
```


```
col_8:
  label: 'Col 8'
  aspectRatio: 0.48
  width: 545
```

## Usage

Can be used in your script (grunt or gulp):

```js
const gen = require('drupal-image-style-generator');
const themeName = 'myTheme';
const themePath = './web/themes/custom/' + themeName;

gen({
    themePath: themePath,
    themeName: themeName,
    syncFolder: './config/sync',
    gridSize: 100,
});
```


## Options

**themePath**: Relative path to the theme - needs to contain the `theme.breakpoints.yml`

**themeName**: the name of the theme

**syncFolder**: Relative path to the sync folder

**gridSize**: (Default: 0) Number to which grid the images are rounded up. In the worst case, the image is gridSize - 1 px to big for the breakpoint, but a higher grid will result in lower individual image styles.

**convertTo**: (Default: null) enables the image_convert style - allowed values are `png`,  `jpg`, `jpeg`, `jpe`, `gif`, `webp` 

