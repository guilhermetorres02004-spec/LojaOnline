module.exports = function asyncHandler(fn) {
    return function (req, resposta, proximo) {
        Promise.resolve(fn(req, resposta, proximo)).catch(proximo);
    };
};
