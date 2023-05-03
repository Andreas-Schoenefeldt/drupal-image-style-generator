const expect = require('chai').expect;
const gen = require('../index');

describe('Running image generator tests', function () {

    it('should check for the existence of the breakpoints.yml file', (done) => {

        const themeName = 'no_breakpoints_yml';

        gen({
            themePath: './test/data/insufficient_modules/web/themes/' + themeName,
            themeName: themeName,
            syncFolder: './test/data/insufficient_modules/config/sync/'
        })

    })

});