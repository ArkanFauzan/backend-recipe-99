const cloudinary = require("cloudinary").v2;
const streamifier = require('streamifier');
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFromBuffer = (bufferFile) => {

    return new Promise((resolve, reject) => {

        let cld_upload_stream = cloudinary.uploader.upload_stream(
        (error, result) => {

            if (result) {
            resolve(result);
            } else {
            reject(error);
            }
        }
        );

        streamifier.createReadStream(bufferFile).pipe(cld_upload_stream);
    });

};

const deleteByPublicId = publicId => {
    return new Promise((resolve, reject)=>{
        cloudinary.uploader.destroy(publicId, function(error,result){
            if (result) {
                resolve(result);
            }else{
                reject(error);
            }
        })
    })
}

 module.exports = {uploadFromBuffer,deleteByPublicId};