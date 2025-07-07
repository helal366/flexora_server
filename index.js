require('dotenv').config();
const express=require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');  // mongodb
const admin = require("firebase-admin");
const app=express();
const port=process.env.PORT || 4000;


// fire admin 
const serviceAccount = require("./flexora-firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middle wire
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const db=client.db('foodDB');  // database
    const usersCollection=db.collection('users') //collection

    // custom middle wire
    const verifyFirebaseToken=async(req,res,next)=>{
        const authHeader=req.headers.authorization;
        if(!authHeader){
            return res.status(401).send({message: 'Unnauthorized access, from authHeader'})
        };
        const token=authHeader.split(' ')[1];
        if(!token){
            return res.status(401).send({message: 'Unauthorized access, from token'})
        }
        try{
            const decoded= await admin.auth().verifyIdToken(token);
            req.decoded=decoded;
        }catch(error){
          return  res.status(403).send({message: 'Forbidden access from try catch token verify', error})
        }
        next()
    }
    // USERS API
    // post users
    app.post('/users', async(req,res)=>{
        try{
            const user=req.body;
            if(!user?.email){
              return  res.status(400).send({message: 'Email is required.'})
            }
            const existingUser= await usersCollection.findOne({email: user?.email});
            if(existingUser){
                return res.status(200).send({message: 'User already exists.'})
            };
            const result=await usersCollection.insertOne(user);
            res.send(result);
        }catch(error){
            console.error('Error creating user', error);
            res.status(500).send({message: 'Server error.'})
        }
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {}
}
run().catch(console.dir);


// connection
app.get('/', (req,res)=>{
    res.send('flexora is running now')
});
app.listen(port, (req,res)=>{
    console.log(`flexora is running on the port: ${port}`)
})