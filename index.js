require('dotenv').config();
const express=require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');  // mongodb
const admin = require("firebase-admin");
const app=express();
const port=process.env.PORT || 4000;


// fire admin 
if (!process.env.FB_SERVICE_KEY) {
  throw new Error('FB_SERVICE_KEY env variable not found!');
}
const decodedKey=Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decodedKey);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middle wire
app.use(cors({
  origin: ['http://localhost:5173', 'https://flexora-188f4.web.app/'],
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
                return res.status(200).send({message: 'User already exists in the database.'})
            };
            const result=await usersCollection.insertOne(user);
            res.send(result);
        }catch(error){
            console.error('Error creating user', error);
            res.status(500).send({message: 'Server error.'})
        }
    });
    // users/patch last login time update
    app.patch('/users/last-login', async(req,res)=>{
      const email=req.body.email;
      const last_login=req.body.last_login;
      try{
        const result=await usersCollection.updateOne({email},{$set: {last_login}});
        res.send({message: 'Last login time updated', result})
      }catch(error){
        res.status(500).send({error: error?.message})
      }
    });
    // users get role by email 
    app.get('/users/role', async(req, res)=>{
      const email=req.query.email;
      const user=await usersCollection.findOne({email});
      res.send({role: user?.role || 'user'})
    })
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {}
}
run().catch(console.dir);

// connection
const html = `<html>
      <head>
        <title>Profast</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-200">
        <div class="my-10 p-10 max-w-xl mx-auto text-center bg-gray-100 shadow-2xl shadow-[#98CD0090] rounded">
          <h1 class="text-3xl font-bold text-teal-600 mb-4">flexora</h1>
          <p class="text-lg text-gray-800 mb-2">🍲 Together, we can reduce food waste and nourish more lives!</p>
          <p class="text-lg text-gray-700 mb-2">🍽️ Let's reduce food waste — every bite counts!</p>
        </div>
      </body>
    </html>`
app.get('/', (req,res)=>{
    res.send(html)
});
app.listen(port, (req,res)=>{
    console.log(`flexora is running on the port: ${port}`)
})