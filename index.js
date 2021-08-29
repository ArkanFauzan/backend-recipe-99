require('dotenv').config();
const AppUrl = 'http://localhost:5000';

const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000 || process.env.PORT;

//import package nanoid
const { customAlphabet } = require('nanoid');
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 33);
// import jwt token package
const jwt = require('jsonwebtoken');

// connect to mysql
const {con} = require('./connection');

// delete the old photo in public/uploads (after being updated)
const fs = require('fs')
const { promisify } = require('util')
const unlinkAsync = promisify(fs.unlink)

// import custom function
const {sha256} = require('./services/function/hash');
const {validateRegister, validateRecipe} = require('./services/function/validateForm');
const {auth} = require('./services/middleware/auth');
const {upload} = require('./services/middleware/multerUpload');

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
    // ingredients, cooking_steps, and recipe_photos format = name_-_*_-_name etc (separate with _-_*_-_) 
    const {name, ingredients, cooking_steps } = req.body;
    req.body.recipe_photos = "";
    req.files.forEach((file,idx) => {
        if(idx!==0){
            req.body.recipe_photos += "_-_*_-_"+file.filename
        }
        else{
            req.body.recipe_photos += file.filename
        }
    });
    const valid = validateRecipe(name,ingredients,cooking_steps,req.body.recipe_photos);
    const {recipe_photos} = req.body;
    if (!valid) {
        if (recipe_photos!=="") {
            if (recipe_photos.split('_-_*_-_').length>=2) {
                recipe_photos.split('_-_*_-_').forEach(async filename=>{
                    if (fs.existsSync(`public\\uploads\\${filename}`)) {
                        await unlinkAsync(`public\\uploads\\${filename}`);
                    }
                })
            }
            else{
                if (fs.existsSync(`public\\uploads\\${recipe_photos}`)){
                    await unlinkAsync(`public\\uploads\\${recipe_photos}`);
                }
            }
        }
        return res.status(422).json({message: "All form field is required"})
    }
    else{
        const query = "insert into recipes values (?,?,?,?,?,?)";
        const dataForm = [nanoid(),req.user.id,name, ingredients, cooking_steps, recipe_photos];
        con.query(query, dataForm, (err, data, fields)=>{
            if(!err){
                return res.status(200).json({message:'success'});
            }
            else{
                return res.status(500).send();
            }
        })
    }
})

app.get('/recipes' , (req,res)=>{
    // ingredients, cooking_steps, and recipe_photos format = name_-_*_-_name etc (separate with _-_*_-_)
    const query = "select recipes.*,users.name as username from recipes join users on recipes.user_id=users.id";
    con.query(query, (err, data, fields)=>{
        if(!err){
            data.forEach(recipe=>{
                if(recipe.recipe_photos.split('_-_*_-_').length===1){
                    recipe.recipe_photos = `${AppUrl}/recipe-image/${recipe.recipe_photos}`
                }
                else{
                    let recipe_photos = "";
                    recipe.recipe_photos.split('_-_*_-_').forEach(photo=>{
                        recipe_photos==="" 
                        ? 
                        recipe_photos += `${AppUrl}/recipe-image/${photo}` 
                        : 
                        recipe_photos += `_-_*_-_${AppUrl}/recipe-image/${photo}`  
                    })
                    recipe.recipe_photos = recipe_photos;
                }
            })
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
                req.files.forEach(async file=>{
                    if (fs.existsSync(`public\\uploads\\${file.filename}`)){
                        await unlinkAsync(`public\\uploads\\${file.filename}`);
                    }
                })
                return res.status(401).send();
            }
            else{
                const oldRecipe = data[0];
                // ingredients, cooking_steps, and recipe_photos format = name_-_*_-_name etc (separate with _-_*_-_) 
                const {name, ingredients, cooking_steps } = req.body;
                req.body.recipe_photos = "";
                req.files.forEach((file,idx) => {
                    if(idx!==0){
                        req.body.recipe_photos += "_-_*_-_"+file.filename
                    }
                    else{
                        req.body.recipe_photos += file.filename
                    }
                });
                const valid = validateRecipe(name,ingredients,cooking_steps,req.body.recipe_photos);
                const {recipe_photos} = req.body;
                if (!valid) {
                    // delete the recently uploaded file
                    if (recipe_photos!=="") {
                        if (recipe_photos.split('_-_*_-_').length>=2) {
                            recipe_photos.split('_-_*_-_').forEach(async filename=>{
                                if (fs.existsSync(`public\\uploads\\${filename}`)){
                                    await unlinkAsync(`public\\uploads\\${filename}`);
                                }
                            })
                        }
                        else{
                            if (fs.existsSync(`public\\uploads\\${recipe_photos}`)){
                                await unlinkAsync(`public\\uploads\\${recipe_photos}`);
                            }
                        }
                    }
                    return res.status(422).json({message: "All form field is required"})
                }
                else{
                    query = "update recipes set name=?, ingredients=?, cooking_steps=?, recipe_photos=? where id=? and user_id=?";
                    const dataForm = [name, ingredients, cooking_steps, recipe_photos, req.params.recipeId, req.user.id];
                    con.query(query, dataForm, async (err, data, fields)=>{
                        if(!err){
                            // delete the old uploaded file
                            if (oldRecipe.recipe_photos!=="") {
                                if (oldRecipe.recipe_photos.split('_-_*_-_').length>=2) {
                                    oldRecipe.recipe_photos.split('_-_*_-_').forEach(async filename=>{
                                        if (fs.existsSync(`public\\uploads\\${filename}`)){
                                            await unlinkAsync(`public\\uploads\\${filename}`);
                                        }
                                    })
                                }
                                else{
                                    if (fs.existsSync(`public\\uploads\\${oldRecipe.recipe_photos}`)){
                                        await unlinkAsync(`public\\uploads\\${oldRecipe.recipe_photos}`);
                                    }
                                }
                            }
                            return res.status(200).json({message:'success'});
                        }
                        else{
                            return res.status(500).send();
                        }
                    })
                }
            }
        }
        else{
            req.files.forEach(async file=>{
                if (fs.existsSync(`public\\uploads\\${file.filename}`)){
                    await unlinkAsync(`public\\uploads\\${file.filename}`);
                }
            })
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
                // ingredients, cooking_steps, and recipe_photos format = name_-_*_-_name etc (separate with _-_*_-_) 
                const query = 'delete from recipes where id=? and user_id=?';
                const dataRecipe = [req.params.recipeId, req.user.id];
                con.query(query, dataRecipe,async (error, data)=>{
                    if(!error){
                        arrPhoto = oldRecipe.recipe_photos.split('_-_*_-_');
                        if(arrPhoto.length>=2){
                            arrPhoto.forEach(async filename=>{
                                if(fs.existsSync(`public\\uploads\\${filename}`)){
                                    await unlinkAsync(`public\\uploads\\${filename}`)
                                }
                            })
                        }
                        else{
                            if(fs.existsSync(`public\\uploads\\${oldRecipe.recipe_photos}`)){
                                await unlinkAsync(`public\\uploads\\${oldRecipe.recipe_photos}`)
                            }
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

app.listen(port, ()=>{
    console.log(`server running at http://localhost:${port}/`)
})