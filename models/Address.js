const mongoose = require('mongoose');

const addressSchema  = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"users",
        required: true,
    },
    address:[{
        addressType :{
            type : String,
            required : true,
        },
        name : {
            type : String,
            required : true,
        },
        apartment : {
            type : String,
            required : true,
        },
        building : {
            type : String,
            required : true,
        },
        street : {
            type : String,
            required : true,
        },
        city : {
            type : String,
            required : true,
        },
        landmark : {
            type : String,
            required : true,
        },
        state : {
            type : String,
            required : true,
        },
        country : {
            type : String,
            required : true,
        },
        zip : {
            type : String,
            required : true,
        },
        
        phone : {
            type : String,
            required : true,
        },
        altPhone : {
            type : String,
            required : true,
        }

    }]
});

const Address = mongoose.model('Address',addressSchema);
module.exports = Address;