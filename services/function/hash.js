const crypto = require('crypto');

const SHA256 = (string, inputEncoding, encoding) => {
    if (!string) {
        return '';
    }
    inputEncoding = inputEncoding || 'utf-8';
    encoding = encoding || 'base64';
    const hash = crypto.createHash('sha256');
    const hash1 = hash.update(string, inputEncoding).digest(encoding);

    const hash2 = crypto.createHash('sha256');
    return hash2.update(hash1.substr(3,21), inputEncoding).digest(encoding);
}

module.exports={
    sha256 : SHA256
}