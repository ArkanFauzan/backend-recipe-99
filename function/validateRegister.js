const validateRegister = (name, email, pass) =>{
    const errName = name.length<3 ? true : false;
    const errEmail = !email.match(/\w+@\w+\.\w+/) ? true : false;
    const errPassword = ( !pass.match(/[a-z]/) || !pass.match(/[A-Z]/) 
                        || !pass.match(/[0-9]/) || pass.length<8 ) ? true : false ;

    return !errName && !errPassword && !errEmail ? true : false;
}

module.exports = {
    validateRegister
}