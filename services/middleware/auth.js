const {con} = require('../../connection');
const jwt = require('jsonwebtoken');

const auth = (req, res, next)=>{
    jwt.verify(req.headers.token, process.env.PRIVATE_KEY, function(error, decoded) {
        if(!error){
            const query = "select id, name, email from users where id=?";
            con.query(query, [decoded.userId] ,(errQuery, data, fields)=>{
                if(!errQuery){
                    if(data.length===1){
                        req.user = data[0];
                        next(); return;
                    }
                    else{
                        return res.status(401).send();
                    }
                }
                else{
                    return res.status(500).send();
                }
            })
        }
        else{
            return res.status(401).send();
        }
    });
    return;
}

module.exports = {
    auth
}