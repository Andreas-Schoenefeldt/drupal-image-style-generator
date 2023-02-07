import log from "fancy-log";

const REQUIRED_OPTIONS = ['themePath', 'themeName', 'syncFolder']

/**
 * @param {{themePath: string, themeName: string, syncFolder: string, gridSize?: number}} options
 */
export default function (options) {

    REQUIRED_OPTIONS.forEach((option) => {
        if (!options[option]) {
            throw new Error(`please configure the required option ${option}.`);
        }
    })

    const themePath = options.themePath;
    const themeName = options.themeName;
    const syncFolder = options.syncFolder;
    const IMAGE_STYLE_GRID_SIZE = options.gridSize || 0; // this means, every style will be rounded up to the next divisible number of this

    const { v4 } = require("uuid");
    const yaml = require('js-yaml');
    const fs   = require('fs');
    const breakpointsFile = themePath + '/' + themeName + '.breakpoints.yml';
    const imageStyles = {};
    const usedStyleConfigs = {};

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
                }

                // adjust the aspect ratio, if a new is set
                if (bp.imageStyles[styleId].aspectRatio) {
                    imageStyles[styleId].aspectRatio = bp.imageStyles[styleId].aspectRatio;
                }

                let width = bp.imageStyles[styleId].width || parsedWidth;

                // adjust the width to the grid, so we save a couple of image styles
                width = Math.ceil(width / IMAGE_STYLE_GRID_SIZE) * IMAGE_STYLE_GRID_SIZE;

                // set the new width
                imageStyles[styleId].width = width;
                imageStyles[styleId].widths[bpName] = imageStyles[styleId].width;
            });
        }

        // loop over all the image styles
        Object.keys(imageStyles).forEach((styleId) => {
            bp.multipliers.forEach((multiplier) => {

                const multiplyNum = parseFloat(multiplier);
                const styleWidth = (imageStyles[styleId].widths[bpName] || parsedWidth) * multiplyNum;
                const aspectRatio = imageStyles[styleId].aspectRatio;

                const uniqueId = v4();

                let styleHeight;
                let styleLabel;
                let concreteStyleId;
                let styleFileName;
                let styleFilePath;

                if (aspectRatio) {
                    styleHeight = imageStyles[styleId].height ? imageStyles[styleId].height * multiplyNum : Math.round(styleWidth * aspectRatio);

                    // generate the filename
                    styleLabel = `Scale and Crop ${styleWidth} x ${styleHeight}`;
                    concreteStyleId = `sc_${styleWidth}x${styleHeight}`;
                    styleFileName = `image.style.${concreteStyleId}.yml`;
                    styleFilePath = `${syncFolder}/${styleFileName}`;

                    usedStyleConfigs[styleFileName] = true;

                    const styleYml = fs.existsSync(styleFilePath) ?
                        yaml.load(fs.readFileSync(styleFilePath, 'utf8')) :
                        {
                            uuid: uniqueId,
                            langcode: 'de',
                            status: true,
                            dependencies: {
                                module: ['focal_point'] // @todo - parse the module config and check, if focal point is enabled
                            },
                            name: concreteStyleId,
                            label: styleLabel,
                            effects: {}
                        }
                    ;

                    const hasChanges = Object.values(styleYml.effects).length === 0 || Object.values(styleYml.effects).some((effectConf) => {
                        return (effectConf.data.width !== styleWidth || effectConf.data.height !== styleHeight); // the width has changed
                    });

                    if (hasChanges) {
                        const effectId = v4();

                        styleYml.effects = {};
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

                        // write the file
                        fs.writeFileSync(styleFilePath, yaml.dump(styleYml));
                        log('Created ' + styleFilePath);
                    } else {
                        log('skipping ' + styleFileName + ' - it already exists and there are no changes.');
                    }

                } else {

                    // generate the filename
                    styleLabel = `Scale ${styleWidth}`;
                    concreteStyleId = `s_${styleWidth}`;
                    styleFileName = `image.style.${concreteStyleId}.yml`;
                    styleFilePath = `${syncFolder}/${styleFileName}`;

                    usedStyleConfigs[styleFileName] = true;

                    const styleYml = fs.existsSync(styleFilePath) ?
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

                    const hasChanges = Object.values(styleYml.effects).length === 0 || Object.values(styleYml.effects).some((effectConf) => {
                        return effectConf.data.width !== styleWidth; // the width has changed
                    });

                    if (hasChanges) {
                        const effectId = v4();

                        styleYml.effects = {};
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

                        // write the file
                        fs.writeFileSync(styleFilePath, yaml.dump(styleYml));
                        log('Created ' + styleFilePath);
                    } else {
                        log('skipping ' + styleFileName + ' - it already exists and there are no changes.');
                    }

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
        if ((file.indexOf('image.style.sc_') === 0 || file.indexOf('image.style.s_') === 0) && !usedStyleConfigs[file]) {
            fs.rmSync(`${syncFolder}/${file}`);
            console.log('%o is unused and was removed.', file);
        }
    });

    log('Generated %d image styles for %d responsive sizes', Object.keys(usedStyleConfigs).length, Object.keys(imageStyles).length);
}