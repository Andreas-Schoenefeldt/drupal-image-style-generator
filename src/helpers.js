module.exports = {

    /**
     *
     * @param {string} effectTypeId
     * @param {Record<string, {uuid: string, id: string, weight: number, data: {}}>} [effects]
     */
    getEffectByTypeId: function (effectTypeId, effects) {
        return effects ? Object.values(effects).find((effect) => {
            return effect.id === effectTypeId
        }) : null;
    }

}