require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//import package nanoid
const { customAlphabet } = require('nanoid');
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 33);
// import jwt token package
const jwt = require('jsonwebtoken');

// connect to mysql
const {con} = require('./connection');

// import custom function
const {sha256} = require('./services/function/hash');
const {validateRegister, validateRecipe} = require('./services/function/validateForm');
const {auth} = require('./services/middleware/auth');
const {upload} = require('./services/middleware/multerUpload');

// To store photo in cloudinary
const {uploadFromBuffer, deleteByPublicId} = require('./services/function/cloudinary')

app.use(cors());
app.use(express.json());
app.use('/recipe-image', express.static('public/uploads'))

setInterval(()=>{
    con.query('select 1');
},5000);

app.get('/', (req,res)=>{
    res.json({haloo:'haloo'});
})

app.post('/register', async (req,res)=>{
    const {name, email, password} = req.body;
    const valid = validateRegister(name, email, password);

    if (valid) {
        let query = "select * from users where email=?";
        con.query(query, [email], (err, data, fields)=>{
            if(data.length>0){
                return res.status(422).json({email:{message:"Email has already been taken"}})
            }
            else{
                query = "insert into users values (?, ?, ?, ?)";
                con.query(query, [nanoid(), name, email, sha256(password)],(err, data, fields)=>{
                    return res.status(200).json({message: "success"});
                })
            }
        })
        return
    }else{
        return res.status(422).json({message:'wrong format'});
    }
})

app.post('/login', (req,res)=>{
    const {email, password} = req.body;
    const query = "select id, name, email from users where email=? and password=?";
    con.query(query, [email, sha256(password)], (err, data, fields)=>{
        if(data.length===1){
            const user = data[0];
            const token = jwt.sign({ userId: user.id }, process.env.PRIVATE_KEY, {expiresIn: 86400});
            return res.status(200).json({token,user});
        }
        else if (data.length===0){
            return res.status(401).json({message: "Email and password not match"});
        }
        else{
            return res.status(500).json({message: "Something error"})
        }
    })
})

app.get('/get-user',(req,res)=>{
    jwt.verify(req.headers.token, process.env.PRIVATE_KEY, function(error, decoded) {
        if(!error){
            const query = "select id, name, email from users where id=?";
            con.query(query, [decoded.userId] ,(errQuery, data, fields)=>{
                if(!errQuery){
                    if(data.length===1){
                        const user = data[0];
                        return res.status(200).json({user});
                    }
                    else{
                        return res.status(422).json({message: errQuery})
                    }
                }
                else{
                    return res.status(500).send();
                }
            })
        }
        else{
            return res.status(401).json({error})
        }
    });
})

app.post('/recipes', [auth, upload.array('recipe_photos', 5)] , async(req,res)=>{
    const {name, ingredients, cooking_steps } = req.body;
    const recipe_photos = [];
    req.files.forEach(file => {
        recipe_photos.push(file.buffer);
    });
    const valid = validateRecipe(name,ingredients,cooking_steps,recipe_photos);
    if (!valid) {
        return res.status(422).json({message: "All form field is required"})
    }
    else{
        // upload photo to cloudinary
        const uploadedPhoto = []
        for(const bufferPhoto of recipe_photos){
            const result = await uploadFromBuffer(bufferPhoto);
            uploadedPhoto.push({
                public_id:  result.public_id,
                secure_url: result.secure_url
            })
        }
        const query = "insert into recipes (id,user_id,name,ingredients,cooking_steps,recipe_photos) values (?,?,?,?,?,?)";
        const dataForm = [nanoid(),req.user.id,name, ingredients, cooking_steps, JSON.stringify(uploadedPhoto)];
        con.query(query, dataForm, (err, data, fields)=>{
            if(!err){
                return res.status(200).json({message:'success'});
            }
            else{
                return res.status(500).json({message:err});
            }
        })
    }
})

app.get('/recipes' , (req,res)=>{
    const query = "select recipes.*,users.name as username from recipes join users on recipes.user_id=users.id";
    con.query(query, (err, data, fields)=>{
        if(!err){
            for(const recipe of data){
                recipe.ingredients = JSON.parse(recipe.ingredients);
                recipe.cooking_steps = JSON.parse(recipe.cooking_steps);
                recipe.recipe_photos = JSON.parse(recipe.recipe_photos);
            }
            return res.status(200).json({recipes:data});
        }
        else{
            return res.status(500).send();
        }
    })
})

app.put('/recipes/:recipeId', [auth, upload.array('recipe_photos', 5)] , async(req,res)=>{
    // validate user. recipes.user_id && recipes.id === req.user.id && req.params.recipeId
    let query = "select * from recipes where id=? and user_id=?";
    const dataRecipe = [req.params.recipeId, req.user.id];
    con.query(query, dataRecipe, async (err, data, fields)=>{
        if(!err){
            if (data.length!==1) {
                return res.status(401).send();
            }
            else{
                const oldRecipe = data[0];

                const {name, ingredients, cooking_steps } = req.body;
                // arr photo (buffer format)
                const recipe_photos = [];
                req.files.forEach(photo => {
                    recipe_photos.push(photo.buffer);
                });

                const valid = validateRecipe(name,ingredients,cooking_steps,recipe_photos);

                if (!valid) {
                    return res.status(422).json({message: "All form field is required"})
                }
                else{
                    const uploadedPhoto = [];
                    for(photo of recipe_photos){
                        const result = await uploadFromBuffer(photo);
                        uploadedPhoto.push({
                            public_id: result.public_id,
                            secure_url: result.secure_url
                        })
                    } 
                    query = "update recipes set name=?, ingredients=?, cooking_steps=?, recipe_photos=? where id=? and user_id=?";
                    const dataForm = [name, ingredients, cooking_steps, JSON.stringify(uploadedPhoto), req.params.recipeId, req.user.id];
                    con.query(query, dataForm, async (err, data, fields)=>{
                        if(!err){
                            // delete the old uploaded file
                            const oldPhoto = JSON.parse(oldRecipe.recipe_photos);
                            for(const photo of oldPhoto){
                                await deleteByPublicId(photo.public_id);
                            }
                            return res.status(200).json({message:'update success'});
                        }
                        else{
                            return res.status(500).send();
                        }
                    })
                }
            }
        }
        else{
            return res.status(500).send();
        }
    }) 
})

app.delete('/recipes/:recipeId', [auth] , async(req,res)=>{
    // validate user. recipes.user_id && recipes.id === req.user.id && req.params.recipeId
    let query = "select * from recipes where id=? and user_id=?";
    const dataRecipe = [req.params.recipeId, req.user.id];
    con.query(query, dataRecipe, async (err, data, fields)=>{
        if(!err){
            if (data.length!==1) {
                return res.status(401).send();
            }
            else{
                const oldRecipe = data[0];

                const query = 'delete from recipes where id=? and user_id=?';
                const dataRecipe = [req.params.recipeId, req.user.id];
                con.query(query, dataRecipe,async (error, data)=>{
                    if(!error){
                        const deletePhoto = JSON.parse(oldRecipe.recipe_photos);
                        for(const photo of deletePhoto){
                            await deleteByPublicId(photo.public_id);
                        }
                        return res.status(200).json({deleted: oldRecipe});
                    }
                    else{
                        return res.status(500).send();
                    }
                })
            }
        }
        else{
            return res.status(500).send();
        }
    }) 
})

// app.post('/tess',[upload.array('recipe_photos',5)],async (req,res)=>{
//     let arrResult = [];
//     for(const file of req.files){
//         const result = await uploadFromBuffer(file.buffer);
//         arrResult.push(result);
//     }
//     return res.json(arrResult)
// })

app.listen(port, ()=>{
    console.log(`server running at http://localhost:${port}/`)
})