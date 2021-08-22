require('dotenv').config()

const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000 || process.env.PORT;

//import package
const { customAlphabet } = require('nanoid');
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 33);

const jwt = require('jsonwebtoken');

// connect to mysql
const {con} = require('./connection');
// import custom function
const {sha256} = require('./function/hash');
const {validateRegister} = require('./function/validateRegister');

app.use(cors());
app.use(express.json());

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

app.listen(port, ()=>{
    console.log(`server running at http://localhost:${port}/`)
})