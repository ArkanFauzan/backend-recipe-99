const validateRegister = (name, email, pass) =>{
    const errName = name.length<3 ? true : false;
    const errEmail = !email.match(/\w+@\w+\.\w+/) ? true : false;
    const errPassword = ( !pass.match(/[a-z]/) || !pass.match(/[A-Z]/) 
                        || !pass.match(/[0-9]/) || pass.length<8 ) ? true : false ;

    return !errName && !errPassword && !errEmail ? true : false;
}

const validateRecipe = (name, ingredients, cooking_steps, recipe_photos) =>{
    return  (name==="" || name===undefined 
            || ingredients==="" || ingredients===undefined
            || cooking_steps==="" || cooking_steps===undefined 
            || recipe_photos==="" || recipe_photos===undefined 
            ) ? false : true;
}

module.exports = {
    validateRegister, validateRecipe
}