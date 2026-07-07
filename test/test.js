const expect = require('chai').expect;
const gen = require('../index');
const fs = require("fs");
const yaml = require("js-yaml");
const {join} = require("node:path");

function clearFiles(folder, pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.isFile() && regex.test(entry.name)) {
            fs.unlinkSync(join(folder, entry.name));
        }
    }
}

describe('Running image generator tests', function () {

    it('should check for the existence of the breakpoints.yml file', () => {
        const themeName = 'no_breakpoints_yml';
        const themePath = './test/data/insufficient_modules/web/themes/' + themeName;

        try {
            const res = gen({
                themePath: themePath,
                themeName: themeName,
                syncFolder: './test/data/insufficient_modules/config/sync/'
            })

            // just in case no exception is thrown
            expect(res).to.be.false;
        } catch (e) {
            expect(e.message).to.equal(`Your configured theme has no ${themePath}/${themeName}.breakpoints.yml theme breakpoints file. Please read the documentation and double check your options.`);
        }
    });

    it('should test for the existence of the focal_point module', () => {
        const themeName = 'no_focal';
        const themePath = './test/data/insufficient_modules/web/themes/' + themeName;

        try {
            const res = gen({
                themePath: themePath,
                themeName: themeName,
                syncFolder: './test/data/insufficient_modules/config/sync/'
            })

            // just in case no exception is thrown
            expect(res).to.be.false;
        } catch (e) {
            expect(e.message).to.equal(`Your drupal installation is missing the focal_point module. Please enable it before generating the image styles.`);
        }
    });

    it('should test for the existence of the crop module', () => {
        const themeName = 'no_crop';
        const themePath = './test/data/insufficient_modules/web/themes/' + themeName;

        try {
            const res = gen({
                themePath: themePath,
                themeName: themeName,
                syncFolder: './test/data/insufficient_modules/config/sync/'
            })

            // just in case no exception is thrown
            expect(res).to.be.false;
        } catch (e) {
            expect(e.message).to.equal(`Your drupal installation is missing the crop module. Please enable it before generating the image styles.`);
        }
    });

    it('should generate the correct crop styles', () => {
        const themeName = 'crop';
        const themePath = './test/data/crop/web/themes/' + themeName;
        const syncFolder = './test/data/crop/config/sync/';

        clearFiles(syncFolder, /^image\.style\.|^responsive_image\.styles\./i);

        const res = gen({
            themePath: themePath,
            themeName: themeName,
            syncFolder: syncFolder
        })


        console.log(fs.readdirSync(syncFolder));


        expect(res).to.be.true;
        expect(fs.readdirSync(syncFolder)).to.include.members([
            'core.extension.yml',
            'crop.type.aspect_165x266.yml',
            'crop.type.aspect_635x424.yml',
            'image.style.mc_1150_aspect_165x266.yml',
            'image.style.mc_1320_aspect_165x266.yml',
            'image.style.mc_290_aspect_635x424.yml',
            'image.style.mc_575_aspect_165x266.yml',
            'image.style.mc_580_aspect_635x424.yml',
            'image.style.mc_660_aspect_165x266.yml',
            'responsive_image.styles.frontpage_hero.yml'
        ]);

        const cropYml = yaml.load(fs.readFileSync(syncFolder + 'crop.type.aspect_165x266.yml', 'utf8'));
        expect(cropYml).to.be.an('object');
        expect(cropYml.aspect_ratio).to.equal('165:266');
    });

    it('should generate the correct height only styles', () => {
        const themeName = 'height';
        const themePath = './test/data/crop/web/themes/' + themeName;
        const syncFolder = './test/data/crop/config/sync/';

        clearFiles(syncFolder, /^image\.style\.|^responsive_image\.styles\./i);

        const res = gen({
            themePath: themePath,
            themeName: themeName,
            syncFolder: syncFolder
        })


        expect(res).to.be.true;
        expect(fs.readdirSync(syncFolder)).to.include.members([
            'core.extension.yml',
            'image.style.sh_38.yml',
            'image.style.sh_76.yml',
            'image.style.sh_88.yml',
            'image.style.sh_108.yml',
            'image.style.sh_176.yml',
            'image.style.sh_216.yml',
            'responsive_image.styles.height_hero.yml'
        ]);

        const scaleYml = yaml.load(fs.readFileSync(syncFolder + 'image.style.sh_108.yml', 'utf8'));
        expect(scaleYml).to.be.an('object');

        const effect = Object.values(scaleYml.effects)[0];

        expect(effect['id']).to.equal('image_scale');
        expect(effect.data.height).to.equal(108);
    });

    it('should generate the correctly preffixed styles', () => {
        const themeName = 'prefixed';
        const themePath = './test/data/crop/web/themes/' + themeName;
        const syncFolder = './test/data/crop/config/sync';

        clearFiles(syncFolder, /^image\.style\.|^responsive_image\.styles\./i);

        const res = gen({
            themePath: themePath,
            themeName: themeName,
            imageStylePrefix: 'is_',
            syncFolder: syncFolder
        });

        expect(res).to.be.true;
        expect(fs.readdirSync(syncFolder)).to.include.members([
            'image.style.is_sc_575x500.yml',
            'image.style.is_sc_660x574.yml',
            'image.style.is_sc_1080x410.yml',
            'image.style.is_sc_1150x1001.yml',
            'image.style.is_sc_1320x1148.yml',
            'image.style.is_sc_2160x821.yml',
            'responsive_image.styles.ris_aspect_hero.yml'
        ]);
    });

    /*
    it('should generate the correct aspect styles and scss files', () => {
        const themeName = 'changing_aspect';
        const themePath = './test/data/crop/web/themes/' + themeName;
        const syncFolder = './test/data/crop/config/sync/';
        const stylesOutDir = themePath + '/assets/scss';

        const res = gen({
            themePath: themePath,
            themeName: themeName,
            syncFolder: syncFolder,
            styleConfig: {
                outDir: stylesOutDir
            }
        });

        expect(res).to.be.true;
    });
     */

});