// import multer
const multer  = require('multer');
// import nanoid
const { customAlphabet } = require('nanoid');
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 33);

const storage = multer.diskStorage({
    destination: './public/uploads',
    filename: function(_req, file, cb){
        const lastIdx = file.originalname.split('.').length-1;
        cb(null, nanoid() +'.' +file.originalname.split('.')[lastIdx]);
    } 
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2200000
    },
    fileFilter: function(_req, file, cb){
        checkFileType(file, cb);
    }
});

function checkFileType(file, cb){
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif/;
    // Check ext
    const extname = filetypes.test(file.originalname.toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null,true);
    } else {
        cb('Error: Images Only!');
    }
}

module.exports = {
    upload
}