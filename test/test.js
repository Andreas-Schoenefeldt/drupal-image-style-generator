const expect = require('chai').expect;
const gen = require('../index');

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

});