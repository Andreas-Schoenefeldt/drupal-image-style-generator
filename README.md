# Drupal Image Style Generator
Drupal Image Style Generator

Allows to generate drupal image styles, based on the `theme.breakpoints.yml` in the theme.

## Installation

```shell
npm i --save-dev drupal-image-style-generator
```

## Setup

configure the width and spect ratio of styles per breakpoint: .xs .sm .md .lg .xl

```
theme.xs_name:
  label: XS
  mediaQuery: "(max-width: 575px)"
  weight: 1
  multipliers:
    - 1x
    - 2x
  imageStyles:
    header_location:
      label: 'Header Standort'
      aspectRatio: 0.59
      width: 545
```

Aspect ratio is calculated height / with. As an example, `16:9` has an spectRatio of `0.563`.

```
col_8:
  label: 'Col 8'
  aspectRatio: 0.48
  width: 545
```

## Usage

Can be used in your build script (standalone, grunt or gulp):

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

**syncFolder**: Relative path to the drupal config sync folder

**gridSize**: (Default: 0) Number to which grid the images are rounded up. In the worst case, the image is gridSize - 1 px to big for the breakpoint, but a higher grid will result in lower individual image styles.

**imageStylePrefix**: (Default: '') any string, that get's added before the generated name.

**convertTo**: (Default: null) enables the image_convert style - allowed values are `png`,  `jpg`, `jpeg`, `jpe`, `gif`, `webp`

**clearCropTypes**: (Default: null) If set to true, unused `crop.type.aspect_*.yml` files will be removed. This can cause a lot of trouble and require you to remove all existing crop definition entities. Should not be done in a live site.  

