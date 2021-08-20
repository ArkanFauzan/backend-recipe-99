require('dotenv').config()

const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000 || process.env.PORT;
const {nanoid} = require('nanoid');

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

        // if(userCount>0){return res.status(422).json({email:{message:"Email has already been taken"}})}
        // else{
        //     query = "insert into users values (?, ?, ?, ?)";
        //     con.query(query, [nanoid(), name, email, sha256(password)],(err, data, fields)=>{
        //         return res.status(200).json({message: "success"});
        //     })
        // }

    }else{
        return res.status(422).json({message:'wrong format'});
    }
})

app.post('/login', (req,res)=>{
    const {email, password} = req.body;
    const query = "select id, name, email from users where email=? and password=?";
    con.query(query, [email, sha256(password)], (err, data, fields)=>{
        return data.length>0 ? res.status(200).json({message:"Success", data: data[0]}) 
                                : res.status(404).json({message: "Email and password not match"});
    })
})

app.listen(port, ()=>{
    console.log(`server running at http:localhost:${port}/`)
})