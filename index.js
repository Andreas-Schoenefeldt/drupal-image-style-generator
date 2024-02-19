const REQUIRED_OPTIONS = ['themePath', 'themeName', 'syncFolder'];
const helpers = require('./src/helpers');
const path = require("path");
const yaml = require("js-yaml");
const {v4} = require("uuid");

/**
 * @param {{themePath: string, themeName: string, syncFolder: string, gridSize?: number, convertTo?: string, clearCropTypes?: boolean}} options
 * @returns {boolean}
 */
module.exports = function (options) {

    REQUIRED_OPTIONS.forEach((option) => {
        if (!options[option]) {
            throw new Error(`please configure the required option ${option}.`);
        }
    })

    const convertTo = options.convertTo
    const themePath = options.themePath;
    const themeName = options.themeName;
    const syncFolder = options.syncFolder;
    const IMAGE_STYLE_GRID_SIZE = options.gridSize || 1; // this means, every style will be rounded up to the next divisible number of this

    const { v4 } = require("uuid");
    const yaml   = require('js-yaml');
    const fs     = require('fs');
    const log    = require('fancy-log');
    const modulesFile = './' + path.normalize(syncFolder + '/core.extension.yml');
    const breakpointsFile = './' + path.normalize(themePath + '/' + themeName + '.breakpoints.yml');
    const imageStyles = {}; // contains the single actual style definitions
    const cropTypes = {}; // contains potentially required crop types
    const usedCropTypes = {};
    const usedStyleConfigs = {};
    const requiredModules = {}; // contains additional custom modules, that need to be enabled before generation

    if (!fs.existsSync(modulesFile)) {
        throw new Error(`Could not find ${modulesFile} - is the sync folder configured correctly?`);
    }

    if (!fs.existsSync(breakpointsFile)) {
        throw new Error(`Your configured theme has no ${breakpointsFile} theme breakpoints file. Please read the documentation and double check your options.`);
    }

    // read the breakpoints file
    const bpConf = yaml.load(fs.readFileSync(breakpointsFile, 'utf8'));

    Object.keys(bpConf).forEach((bpName) => {
        const bp = bpConf[bpName];
        let regex = /max-width:\s+(\d+)px/gmi;

        let m = regex.exec(bp.mediaQuery);
        let parsedWidth = m ? parseInt(m[1], 10) : null;

        if (!parsedWidth) {
            regex = /min-width:\s+(\d+)px/gmi;
            m = regex.exec(bp.mediaQuery);
            parsedWidth = m ? parseInt(m[1], 10) : null;
        }

        // update all available image styles
        if (bp.imageStyles) {
            Object.keys(bp.imageStyles).forEach((styleId) => {
                if (!imageStyles[styleId]) {
                    imageStyles[styleId] = bp.imageStyles[styleId];
                    imageStyles[styleId].image_style_mappings = [];

                    imageStyles[styleId].widths = {};
                    imageStyles[styleId].heights = {};
                    imageStyles[styleId].cropTypes = {};
                }

                // adjust the aspect ratio, if a new is set
                if (bp.imageStyles[styleId].aspectRatio) {
                    imageStyles[styleId].aspectRatio = bp.imageStyles[styleId].aspectRatio;

                    if (imageStyles[styleId].manual_crop) {
                        requiredModules['crop'] = true;
                    } else {
                        requiredModules['focal_point'] = true;
                    }
                }

                let height = bp.imageStyles[styleId].height || imageStyles[styleId].height; // if height is set once, this is set

                if (height) {
                    // set the new height
                    imageStyles[styleId].height = height;
                    imageStyles[styleId].heights[bpName] = height;
                }

                if (!height || bp.imageStyles[styleId].width) {
                    let width = bp.imageStyles[styleId].width || parsedWidth;

                    // adjust the width to the grid, so we save a couple of image styles
                    width = Math.ceil(width / IMAGE_STYLE_GRID_SIZE) * IMAGE_STYLE_GRID_SIZE;

                    // set the new width
                    imageStyles[styleId].width = width;
                    imageStyles[styleId].widths[bpName] = imageStyles[styleId].width;
                }

                if (imageStyles[styleId].manual_crop) {
                    imageStyles[styleId].cropTypes[bpName] = 'aspect_' + imageStyles[styleId].aspectRatio.replace(':', 'x');
                }

            });
        }

        // loop over all the image styles
        Object.keys(imageStyles).forEach((styleId) => {
            bp.multipliers.forEach((multiplier) => {
                const multiplyNum = parseFloat(multiplier);
                const styleWidth = (imageStyles[styleId].widths[bpName] || parsedWidth) * multiplyNum;
                const aspectRatio = imageStyles[styleId].aspectRatio;
                const manualCrop = imageStyles[styleId].manual_crop;

                const uniqueId = v4();

                let styleHeight;
                let styleLabel;
                let concreteStyleId;
                let styleFileName;
                let styleFilePath;
                let styleYml;
                let hasChanges;

                if (manualCrop) {
                    const cropType = imageStyles[styleId].cropTypes[bpName];
                    const cropDimensions = cropType.split('_')[1].split('x').map((num) => {
                        return parseInt(num, 10);
                    });
                    const aspectRatio = cropDimensions[1] / cropDimensions[0];

                    if (!cropTypes[cropType]) {
                        cropTypes[cropType] = {
                            label: `Aspect Ratio ${cropDimensions[0]}:${cropDimensions[1]}`,
                            aspect_ratio: `${cropDimensions[0]}:${cropDimensions[1]}`,
                            soft_limit_width: styleWidth,
                            soft_limit_height: Math.round(styleWidth * aspectRatio)
                        }
                    } else {
                        cropTypes[cropType].soft_limit_width = Math.max(cropTypes[cropType].soft_limit_width, styleWidth);
                        cropTypes[cropType].soft_limit_height = Math.round(Math.max(cropTypes[cropType].soft_limit_height, styleWidth * aspectRatio));
                    }

                    styleLabel = `Manual Crop and Scale ${styleWidth}, aspect ${cropDimensions[0]}:${cropDimensions[1]}`;
                    concreteStyleId = `mc_${styleWidth}_${cropType}`;
                    styleFileName = `image.style.${concreteStyleId}.yml`;
                    styleFilePath = `${syncFolder}/${styleFileName}`;

                    styleYml = fs.existsSync(styleFilePath) ?
                        yaml.load(fs.readFileSync(styleFilePath, 'utf8')) :
                        {
                            uuid: uniqueId,
                            langcode: 'de',
                            status: true,
                            dependencies: {
                                config: ['crop.type.' + cropType],
                                module: ['crop']
                            },
                            name: concreteStyleId,
                            label: styleLabel,
                            effects: {}
                        }
                    ;

                    const convertEffect = helpers.getEffectByTypeId('image_convert', styleYml.effects);
                    const cropEffect = helpers.getEffectByTypeId('crop_crop', styleYml.effects);
                    const scaleEffect = helpers.getEffectByTypeId('image_scale', styleYml.effects);

                    hasChanges = !scaleEffect || scaleEffect.data.width !== styleWidth ||
                        !cropEffect || cropEffect.data.crop_type !== cropType ||
                        (convertTo && (!convertEffect || (convertEffect && convertEffect.data.extension !== convertTo))) || (!convertTo && convertEffect)
                    ;

                    if (hasChanges) {
                        styleYml.effects = {};

                        if (convertTo) {
                            const convertEffectId = v4();
                            styleYml.effects[convertEffectId] = {
                                uuid: convertEffectId,
                                id: 'image_convert',
                                weight: -1,
                                data: {
                                    extension: convertTo
                                }
                            }
                        }

                        const effectId = v4();
                        styleYml.effects[effectId] = {
                            uuid: effectId,
                            id: 'crop_crop',
                            weight: 1,
                            data: {
                                crop_type: cropType,
                                automatic_crop_provider: null
                            }
                        };

                        const scaleEffectId = v4();
                        styleYml.effects[scaleEffectId] = {
                            uuid: scaleEffectId,
                            id: 'image_scale',
                            weight: 2,
                            data: {
                                width: styleWidth,
                                height: null,
                                upscale: false
                            }
                        };
                    }

                } else if (aspectRatio) {
                    styleHeight = imageStyles[styleId].height ? imageStyles[styleId].height * multiplyNum : Math.round(styleWidth * aspectRatio);

                    // generate the filename
                    styleLabel = `Scale and Crop ${styleWidth} x ${styleHeight}`;
                    concreteStyleId = `sc_${styleWidth}x${styleHeight}`;
                    styleFileName = `image.style.${concreteStyleId}.yml`;
                    styleFilePath = `${syncFolder}/${styleFileName}`;

                    styleYml = fs.existsSync(styleFilePath) ?
                        yaml.load(fs.readFileSync(styleFilePath, 'utf8')) :
                        {
                            uuid: uniqueId,
                            langcode: 'de',
                            status: true,
                            dependencies: {
                                module: ['focal_point']
                            },
                            name: concreteStyleId,
                            label: styleLabel,
                            effects: {}
                        }
                    ;

                    const scaleEffect = helpers.getEffectByTypeId('focal_point_scale_and_crop', styleYml.effects);
                    const convertEffect = helpers.getEffectByTypeId('image_convert', styleYml.effects);

                    hasChanges = !scaleEffect || scaleEffect.data.width !== styleWidth || scaleEffect.data.height !== styleHeight ||
                        (convertTo && (!convertEffect || (convertEffect && convertEffect.data.extension !== convertTo))) || (!convertTo && convertEffect)
                    ;

                    if (hasChanges) {
                        styleYml.effects = {};

                        if (convertTo) {
                            const convertEffectId = v4();
                            styleYml.effects[convertEffectId] = {
                                uuid: convertEffectId,
                                id: 'image_convert',
                                weight: -1,
                                data: {
                                    extension: convertTo
                                }
                            }
                        }

                        const effectId = v4();
                        styleYml.effects[effectId] = {
                            uuid: effectId,
                            id: 'focal_point_scale_and_crop',
                            weight: 1,
                            data: {
                                width: styleWidth,
                                height: imageStyles[styleId].height ? imageStyles[styleId].height * multiplyNum : Math.round(styleWidth * imageStyles[styleId].aspectRatio),
                                crop_type: 'focal_point'
                            }
                        };
                    }
                } else if (imageStyles[styleId].height) {
                    // this is a height style
                    const styleHeight = imageStyles[styleId].heights[bpName] * multiplyNum;
                    styleLabel = `Scale Height ${styleHeight}`;
                    concreteStyleId = `sh_${styleHeight}`;
                    styleFileName = `image.style.${concreteStyleId}.yml`;
                    styleFilePath = `${syncFolder}/${styleFileName}`;

                    styleYml = fs.existsSync(styleFilePath) ?
                        yaml.load(fs.readFileSync(styleFilePath, 'utf8')) :
                        {
                            uuid: uniqueId,
                            langcode: 'de',
                            status: true,
                            dependencies: {},
                            name: concreteStyleId,
                            label: styleLabel,
                            effects: {}
                        }
                    ;

                    const scaleEffect = helpers.getEffectByTypeId('image_scale', styleYml.effects);
                    const convertEffect = helpers.getEffectByTypeId('image_convert', styleYml.effects);

                    hasChanges = !scaleEffect || scaleEffect.data.height !== styleHeight ||
                        (convertTo && (!convertEffect || (convertEffect && convertEffect.data.extension !== convertTo))) || (!convertTo && convertEffect)
                    ;

                    if (hasChanges) {
                        styleYml.effects = {};

                        if (convertTo) {
                            const convertEffectId = v4();
                            styleYml.effects[convertEffectId] = {
                                uuid: convertEffectId,
                                id: 'image_convert',
                                weight: -1,
                                data: {
                                    extension: convertTo
                                }
                            }
                        }

                        const effectId = v4();
                        styleYml.effects[effectId] = {
                            uuid: effectId,
                            id: 'image_scale',
                            weight: 1,
                            data: {
                                width: null,
                                height: styleHeight,
                                upscale: false
                            }
                        };
                    }

                } else {

                    // generate the filename
                    styleLabel = `Scale ${styleWidth}`;
                    concreteStyleId = `s_${styleWidth}`;
                    styleFileName = `image.style.${concreteStyleId}.yml`;
                    styleFilePath = `${syncFolder}/${styleFileName}`;

                    styleYml = fs.existsSync(styleFilePath) ?
                        yaml.load(fs.readFileSync(styleFilePath, 'utf8')) :
                        {
                            uuid: uniqueId,
                            langcode: 'de',
                            status: true,
                            dependencies: {},
                            name: concreteStyleId,
                            label: styleLabel,
                            effects: {}
                        }
                    ;

                    const scaleEffect = helpers.getEffectByTypeId('image_scale', styleYml.effects);
                    const convertEffect = helpers.getEffectByTypeId('image_convert', styleYml.effects);

                    hasChanges = !scaleEffect || scaleEffect.data.width !== styleWidth ||
                        (convertTo && (!convertEffect || (convertEffect && convertEffect.data.extension !== convertTo))) || (!convertTo && convertEffect)
                    ;

                    if (hasChanges) {
                        styleYml.effects = {};

                        if (convertTo) {
                            const convertEffectId = v4();
                            styleYml.effects[convertEffectId] = {
                                uuid: convertEffectId,
                                id: 'image_convert',
                                weight: -1,
                                data: {
                                    extension: convertTo
                                }
                            }
                        }

                        const effectId = v4();
                        styleYml.effects[effectId] = {
                            uuid: effectId,
                            id: 'image_scale',
                            weight: 1,
                            data: {
                                width: styleWidth,
                                height: null,
                                upscale: false
                            }
                        };
                    }
                }

                usedStyleConfigs[styleFileName] = true;

                if (hasChanges) {
                    // write the file
                    fs.writeFileSync(styleFilePath, yaml.dump(styleYml));
                    log('Created ' + styleFilePath);
                } else {
                    log('skipping ' + styleFileName + ' - it already exists and there are no changes.');
                }

                imageStyles[styleId].image_style_mappings.push({
                    breakpoint_id: bpName,
                    multiplier: multiplier,
                    image_mapping_type: 'image_style',
                    image_mapping: concreteStyleId
                });

            });
        });
    });

    // test the required modules
    const modulesConf = yaml.load(fs.readFileSync(modulesFile, 'utf8')).module;
    Object.keys(requiredModules).forEach((moduleName) => {
        if (requiredModules[moduleName] && modulesConf[moduleName] !== 0) {
            throw new Error(`Your drupal installation is missing the ${moduleName} module. Please enable it before generating the image styles.`)
        }
    });

    // write the actual crop types files
    Object.keys(cropTypes).forEach((cropTypeId) => {
        const type = cropTypes[cropTypeId];
        const cropTypeFileName = `crop.type.${cropTypeId}.yml`;
        const cropTypePath = `${syncFolder}/${cropTypeFileName}`;
        const uniqueId = v4();
        const cropTypeConfig = fs.existsSync(cropTypePath) ?
            yaml.load(fs.readFileSync(cropTypePath, 'utf8')) :
            {
                uuid: uniqueId,
                langcode: 'de',
                status: true,
                dependencies: {},
                label: type.label,
                id: cropTypeId,
                description: type.label,
                aspect_ratio: type.aspect_ratio,
                soft_limit_width: type.soft_limit_width,
                soft_limit_height: type.soft_limit_height,
                hard_limit_width: null,
                hard_limit_height: null
            }
        ;

        // adjust in case something changed
        cropTypeConfig.label = type.label;
        cropTypeConfig.description = type.label;
        cropTypeConfig.aspect_ratio = type.aspect_ratio;
        cropTypeConfig.soft_limit_width = type.soft_limit_width;
        cropTypeConfig.soft_limit_height = type.soft_limit_height;

        usedCropTypes[cropTypeFileName] = true;

        fs.writeFileSync(cropTypePath, yaml.dump(cropTypeConfig));
        log('Created crop type ' + cropTypePath);
    });

    // write the actual responsive config files
    Object.keys(imageStyles).forEach((styleId) => {
        const responsiveImagePath = `${syncFolder}/responsive_image.styles.${styleId}.yml`;
        const uniqueId = v4();
        const responsiveConfig = fs.existsSync(responsiveImagePath) ?
            yaml.load(fs.readFileSync(responsiveImagePath, 'utf8')) :
            {
                uuid: uniqueId,
                langcode: 'de',
                status: true,
                dependencies: {
                    config: [],
                    theme: [themeName]
                },
                id: styleId,
                label: imageStyles[styleId].label,
                image_style_mappings: [],
                breakpoint_group: themeName
            }
        ;

        const mappings = imageStyles[styleId].image_style_mappings;

        responsiveConfig.dependencies.config = mappings.map((mapping) => {
            return 'image.style.' + mapping.image_mapping;
        });

        responsiveConfig.image_style_mappings = mappings;
        responsiveConfig.fallback_image_style = mappings[0].image_mapping;

        fs.writeFileSync(responsiveImagePath, yaml.dump(responsiveConfig));
        log('Created ' + responsiveImagePath);
    });

    // cleanup the unused files
    const configFiles = fs.readdirSync(syncFolder);

    configFiles.forEach(file => {
        if (
            ((file.indexOf('image.style.sc_') === 0 || file.indexOf('image.style.s_') === 0 || file.indexOf('image.style.mc_') === 0) && !usedStyleConfigs[file]) ||
            (options.clearCropTypes && file.indexOf('crop.type.aspect_') === 0 && !usedCropTypes[file])
        ) {
            fs.rmSync(`${syncFolder}/${file}`);
            console.log('%o is unused and was removed.', file);
        }
    });

    log('Generated %d image styles for %d responsive sizes', Object.keys(usedStyleConfigs).length, Object.keys(imageStyles).length);

    return true;
}
