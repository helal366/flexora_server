require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');  // mongodb
const admin = require("firebase-admin");
const { getAuth } = require('firebase-admin/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 4000;


// fire admin 
if (!process.env.FB_SERVICE_KEY) {
  throw new Error('FB_SERVICE_KEY env variable not found!');
}
const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decodedKey);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middle wire
const allowedOrigins = ['http://localhost:5173', 'https://flexora-188f4.web.app']
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
    const db = client.db('foodDB');  // database
    const usersCollection = db.collection('users') //collection
    const transectionCollection = db.collection('transections') //collection
    const donationsCollection = db.collection('donations') //collection
    const requestsCollection = db.collection('requests') //collection
    const reviewsCollection = db.collection('reviews') //collection
    const favoritesCollection = db.collection('favorites') //collection

    // const result1 = await requestsCollection.updateMany(
    //   { charity_representative_email: 'nazrul@gmail.com' },
    //   { $set: { charity_logo: 'https://i.postimg.cc/8Cp8FZ4p/food-hope-foundation.webp' } }
    // );
    // console.log('✅ Static update done:', result1.modifiedCount);

    // const result2 = await reviewsCollection.updateMany(
    //   { restaurant_email: 'support@savornest.com' },
    //   {
    //     $set: { restaurant_location: 'Farmgate' }
    //   }
    // );
    // console.log('✅ Static update done:', result2.modifiedCount);

    // CUSTOM MIDDLE WIRES
    // token verification
    const verifyFirebaseToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access, from authHeader' })
      };
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).send({ message: 'Unauthorized access, from token' })
      }
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        // console.log({decoded})
        req.decoded = decoded;
      } catch (error) {
        return res.status(403).send({ message: 'Forbidden access from try catch token verify', error })
      }
      next()
    }

    // email verification
    const verifyEmail = (req, res, next) => {
      const decodedEmail = req.decoded?.email; // set by verifyFirebaseToken middleware
      const emailToCheck = req?.query?.email || req?.params?.email || req?.body?.email;

      if (!decodedEmail) {
        return res.status(401).json({ message: 'Unauthorized: missing decoded email' });
      }

      if (!emailToCheck) {
        return res.status(400).json({ message: 'Bad request: no email provided to verify' });
      }

      if (decodedEmail !== emailToCheck) {
        return res.status(403).json({ message: 'Forbidden: email mismatch' });
      }

      next();
    };

    // USERS API
    // post users
    app.post('/users', async (req, res) => {
      const user = req.body;
      const userEmail=user?.email;
      try {
        if (!userEmail) {
          return res.status(400).send({ message: 'Email is required.' })
        }
        const existingUser = await usersCollection.findOne({ email: userEmail });
        if (existingUser) {
          return res.status(200).send({ message: 'User already exists in the database.' })
        };
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Server error.', error: error?.message})
      }
    });
    // users/patch last login time update
    app.patch('/users/last-login', verifyFirebaseToken, async (req, res) => {
      const { email, last_login } = req.body;
      if (!email || !last_login) {
        return res.status(400).send({ message: 'Email and last_login are required.' });
      }
      try {
        const result = await usersCollection.updateOne({ email }, { $set: { last_login } });
        res.send({ message: 'Last login time updated', result })
      } catch (error) {
        res.status(500).send({ error: error?.message })
      }
    });
    // stripe create-payment-intent
    app.post('/create-payment-intent', verifyFirebaseToken, async (req, res) => {
      const { amount } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100,
          currency: 'USD',
          payment_method_types: ['card']
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ message: 'Failed to create payment intent', error })
      }
    });
    // stripe save transection after successful payment
    app.post('/save-transection', verifyFirebaseToken, async (req, res) => {
      const transection = req.body;
      transection.request_time = new Date();
      try {
        const result = await transectionCollection.insertOne(transection);
        res.send({ message: 'Transection saved successfully.', result })
      } catch (error) {
        res.status(500).send({ message: 'Failed to save transection', error })
      }
    })
    // users patch role request
    app.patch(`/users/role_request/:email`, verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      // console.log('Received role request for:', email);
      const updatedDoc = req.body;
      const { status } = req.body;
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: 'Forbidden! Email mismatch from role request.' })
      }
      try {
        const updateResult = await usersCollection.updateOne({ email }, {
          $set: updatedDoc
        });
        const updateTransectionStatus = await transectionCollection.updateOne({ email }, {
          $set: { status }
        })
        res.send({ message: 'Role request submitted successfully.', userUpdate: updateResult, transectionUpdate: updateTransectionStatus })
      } catch (error) {
        res.status(500).send({ error: 'Failed to update user data' })
      }
    });
    // users patch charity profile update
    app.patch('/users/update-charity-profile/:email', verifyFirebaseToken, async (req, res) => {
      const emailParam = req.params.email;
      const requesterEmail = req.decoded.email;

      if (emailParam !== requesterEmail) {
        return res.status(403).send({ error: 'Forbidden: Email mismatch' });
      }

      const updatedData = req.body;

      try {
        const filter = { email: emailParam };
        const updateDoc = {
          $set: {
            contact_number: updatedData.contact_number,
            organization_name: updatedData.organization_name,
            organization_email: updatedData.organization_email,
            organization_contact: updatedData.organization_contact,
            organization_address: updatedData.organization_address,
            organization_tagline: updatedData.organization_tagline,
            mission: updatedData.mission,
            organization_logo: updatedData.organization_logo,
            photoURL: updatedData.photoURL,
            // Optionally update status and transection_id only if passed
            // ...(updatedData.status && { status: updatedData.status }),
            // ...(updatedData.transection_id && { transection_id: updatedData.transection_id })
          }
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        res.send(result);
      } catch (error) {
        console.error('Charity profile update failed:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });
    // users patch restaurant profile update
    app.patch('/users/update-restaurant-profile/:email', verifyFirebaseToken, async (req, res) => {
      const emailParam = req.params.email;
      const requesterEmail = req.decoded.email;

      if (emailParam !== requesterEmail) {
        return res.status(403).send({ error: 'Forbidden: Email mismatch' });
      }

      const updatedData = req.body;

      try {
        const filter = { email: emailParam };
        const updateDoc = {
          $set: {
            contact_number: updatedData.contact_number,
            organization_name: updatedData.organization_name,
            organization_email: updatedData.organization_email,
            organization_contact: updatedData.organization_contact,
            organization_address: updatedData.organization_address,
            organization_tagline: updatedData.organization_tagline,
            mission: updatedData.mission,
            organization_logo: updatedData.organization_logo,
            photoURL: updatedData.photoURL,
          }
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        res.send(result);
      } catch (error) {
        console.error('Restaurant profile update failed:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    // users get user by email 
    app.get('/user', verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      console.log(email)
      const user_by_email = await usersCollection.findOne({ email });
      res.send({ user_by_email: user_by_email })
    });
    // users get all users
    app.get('/users/all', verifyFirebaseToken, async (req, res) => {
      const allUsers = await usersCollection.find().toArray();
      res.send(allUsers);
    });
    // users direct role change by admin and patch app
    app.patch('/user/direct_role_change/:adminEmail/:candidateEmail', verifyFirebaseToken, async (req, res) => {
      const adminEmail = req.params.adminEmail;
      const candidateEmail = req.params.candidateEmail;
      if (req?.decoded?.email !== adminEmail) {
        res.status(403).send('Forbidden! Email mismatch from direct role change by admin.');
      }
      const updatedDoc = req.body;
      // console.log({updatedDoc})
      try {
        const result = await usersCollection.updateOne({ email: candidateEmail }, { $set: updatedDoc })
        res.send('Role directly update by admin is successful', result)
      } catch (error) {
        res.status(500).send('Failed to directly update role by admin.')
      }
    });
    // Delete user
    app.delete('/users/:id', verifyFirebaseToken, async (req, res) => {
      let id;
      try {
        id = new ObjectId(req.params.id);
      } catch (error) {
        return res.status(404).send({ message: 'Invalid user ID format', error: error })
      }
      try {
        // find the user first to find the uid
        const userToDelete = await usersCollection.findOne({ _id: id });
        if (!userToDelete) {
          return res.status(404).send({ message: 'User not found.' })
        }
        // delete from firebase
        const uid = userToDelete?.uid;
        const transectionId = userToDelete?.transection_id
        if (uid) {
          await getAuth().deleteUser(uid)
        } else {
          return res.status(404).send({ message: 'User UID not found' })
        }
        // delete associated transection
        let deleteTransectionResult = { deletedCount: 0 }
        if (transectionId) {
          deleteTransectionResult = await transectionCollection.deleteOne({ transection_id: transectionId });
        }
        // delete user from mongodb
        const deleteFromMongodb = await usersCollection.deleteOne({ _id: id });
        res.send({
          message: 'User successfully deleted from mongodb firebase and with associated transection',
          firebaseDeleted: !!uid,
          userDeleted: deleteFromMongodb,
          transectionDeleted: deleteTransectionResult
        })

      } catch (error) {
        res.status(500).send({ message: 'Failed to delete user.', error: error })
      }
    })
    // users get all role request 
    app.get('/users/role_requests', verifyFirebaseToken, async (req, res) => {
      try {
        const roleRequests = await usersCollection.find({
          role: {
            $in: ['charity_role_request', 'restaurant_role_request']
          }
        }).toArray();
        res.status(200).json({ success: true, data: roleRequests });

      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch role request', error: error })
      }
    });
    // users role update to restaurant or charity for approved or reject to user;
    app.patch('/users/role_request_update/:candidateEmail/:adminEmail', verifyFirebaseToken, async (req, res) => {
      const candidateEmail = decodeURIComponent(req?.params?.candidateEmail);
      const adminEmail = decodeURIComponent(req?.params?.adminEmail);

      // Verify token belongs to the admin
      if (req?.decoded?.email !== adminEmail) {
        return res.status(403).send('Forbidden! Email mismatch from approved rejected route.');
      }

      const updatedDoc = req.body;
      const { status } = req.body;

      try {
        // ✅ Optional: check if candidate user exists
        const candidateUser = await usersCollection.findOne({ email: candidateEmail });
        if (!candidateUser) {
          return res.status(404).send({ message: 'User not found.' });
        }

        // ✅ Get transaction data
        const candidateTransection = await transectionCollection.findOne({ user_email: candidateEmail });
        const transectionId = candidateTransection?.transection_id;

        // ✅ Update user document
        const userUpdateResult = await usersCollection.updateOne(
          { email: candidateEmail },
          { $set: updatedDoc }
        );

        if (userUpdateResult.matchedCount === 0) {
          return res.status(400).send({ message: 'User update failed: email not matched.' });
        }

        // ✅ Update transaction document, if found
        if (transectionId) {
          const transectionStatusUpdate = await transectionCollection.updateOne(
            { user_email: candidateEmail },
            { $set: { status } }
          );

          if (transectionStatusUpdate.matchedCount === 0) {
            return res.status(400).send({ message: 'Transaction update failed: not found.' });
          }
        }

        // ✅ Final success response
        return res.send({
          message: 'User status and role updated successfully',
          userUpdate: userUpdateResult
        });

      } catch (err) {
        res.status(500).send({
          message: 'Status and role update failed!',
          error: err.message
        });
      }
    });
    // user get user by organization email for charity requests list for home page
    app.get('/user/charity_requests/:charity_email', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { charity_email } = req.params;
      if (!charity_email) {
        return res.status(400).send({ message: 'Charity email is required' })
      }
      try {
        const charity = await usersCollection.findOne({ organization_email: charity_email });
        res.status(200).send(charity)
      } catch (error) {
        res.status(500).send({ message: 'Failed to find charity!', error: error?.message })
      }
    })

    // TRANSECTION
    // GET /transactions?email=user@example.com
    app.get('/transactions', verifyFirebaseToken, async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).send({ error: 'Email is required' });
        }
        const decodedEmail = req?.decoded?.email;
        if (decodedEmail !== email) {
          return res.status(403).send('Forbidden access from get transection by email')
        }

        const transactions = await transectionCollection
          .find({
            user_email: email,
            purpose: 'Charity role request'
          })
          .sort({ request_time: -1 }) // most recent first
          .toArray();

        res.send(transactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });


    // DONATIONS
    // POST /donations - Add a new donation
    app.post('/donations', verifyFirebaseToken, async (req, res) => {
      try {
        const donationData = req.body;
        console.log(donationData)
        // Add status and posted_at timestamp
        donationData.status = 'Pending';
        donationData.posted_at = new Date(); // current date and time

        const result = await donationsCollection.insertOne(donationData);

        res.status(201).send({
          message: 'Donation added successfully',
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error('Error adding donation:', error);
        res.status(500).send({
          message: 'Failed to add donation',
          error: error.message,
        });
      }
    });

    // get all donations 
    app.get('/donations', verifyFirebaseToken, async (req, res) => {
      const { email, status } = req.query;
      const query = {};

      if (email) {
        query.restaurant_representative_email = email;
      }
      if (status) {
        query.status = status
      }

      try {
        // You can also check user role here if needed, e.g. only admin allowed

        const donations = await donationsCollection.find(query).sort({ posted_at: -1 }).toArray();
        res.status(200).json(donations);
      } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ message: 'Failed to fetch donations', error: error.message });
      }
    });

    // PATCH: Update donation status by ID
    app.patch('/donations/:id', verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      const { email } = req.query;
      const decodedEmail = req?.decoded?.email;

      if (decodedEmail !== email) {
        return res.status(403).send('Forbidden access from get donations');
      }

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid donation ID.' });
      }

      const _id = new ObjectId(id);
      const updateFields = req.body;

      const allowedFields = [
        'donation_title',
        'food_type',
        'quantity',
        'unit',
        'pickup_time_window',
        'location',
        'image',
        'status',
        'donation_status',
        'request_status',
        'updated_at',
      ];

      const updatedDoc = {};
      for (const key of allowedFields) {
        if (updateFields.hasOwnProperty(key)) {
          updatedDoc[key] = updateFields[key];
        }
      }

      if (!updatedDoc.updated_at) {
        updatedDoc.updated_at = new Date();
      }

      try {
        const result = await donationsCollection.updateOne(
          { _id },
          { $set: updatedDoc }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Donation not found.' });
        }

        if (result.modifiedCount === 0) {
          return res.status(200).json({ message: 'No changes detected.' });
        }

        res.status(200).json({
          message: 'Donation updated successfully.',
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error('Error updating donation:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });


    // PATCH: update for feature donation
    app.patch('/donations/feature/:id', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const id = req.params.id;
      const { email } = req?.query;
      const decodedEmail = req?.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send('Forbidden access from feature donation update')
      }
      const result = await donationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { is_featured: true } }
      );
      res.send(result);
    });

    // GET: featured donations
    app.get('/donations/featured', verifyFirebaseToken, verifyEmail, async (req, res) => {
      try {
        const featured = await donationsCollection
          .find({ is_featured: true })
          .sort({ updated_at: -1 })
          .limit(8)
          .toArray();

        res.send(featured);
      } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error?.message });
      }
    });

    // Get a single donation by ID
    app.get('/donations/:id', verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      const email = req?.query?.email;
      const decodedEmail = req?.decoded?.email;

      // Check email mismatch for authorization
      if (decodedEmail !== email) {
        return res.status(403).send({ message: 'Forbidden! Email mismatch from role request.' });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid donation ID format.' });
      }

      try {
        const donation = await donationsCollection.findOne({ _id: new ObjectId(id) });

        if (!donation) {
          return res.status(404).send({ error: 'Donation not found.' });
        }

        res.status(200).json(donation);
      } catch (error) {
        console.error('Error fetching donation:', error);
        // Here 500 Internal Server Error might be more appropriate for unexpected errors
        res.status(500).json({ message: 'Failed to fetch donation.', error: error?.message });
      }
    });

    // donations delete single donation from MyDonation component
    app.delete('/donations/:id', verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;

      try {
        const result = await donationsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.status(200).send({ message: 'Donation deleted successfully.' });
        } else {
          res.status(404).send({ message: 'Donation not found.' });
        }
      } catch (error) {
        console.error('Error deleting donation:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // donations pickup
    app.patch('/donations/pickup/:id', verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'Picked Up',
          picked_up_at: new Date()
        }
      };
      const result = await donationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // DONATIONS: patch route to add favorites_email_list
    app.patch('/donations/add_favorite/:donationId', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { email } = req.query
      const { donationId } = req?.params;
      if (!donationId) {
        return res.status(400).send({ message: 'Missing donationId in request parameters' })
      }
      if (!ObjectId.isValid(donationId)) {
        return res.status(400).send({ message: 'Invalid donation ID format' });
      }
      const _id = new ObjectId(donationId)
      const donation = await donationsCollection.findOne({ _id });
      if (!donation) {
        return res.status(404).send({ message: 'Donation not found.' })
      }

      const result = await donationsCollection.updateOne(
        { _id },
        { $addToSet: { favoriters_email_list: email } }
      );
      if (result?.modifiedCount === 0) {
        return res.status(409).send({ message: 'Already favorited by the user.' })
      }
      res.send(result)

    })

    // donations get details
    app.get('/donations/details/:id', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'Donation ID is required' });
      }

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid Donation ID' });
        }

        const donation = await donationsCollection.findOne({ _id: new ObjectId(id) });

        if (!donation) {
          return res.status(404).json({ message: 'Donation not found' });
        }

        res.status(200).json(donation);
      } catch (error) {
        res.status(500).json({
          message: 'Failed to fetch donation details',
          error: error.message,
        });
      }
    });


    // REQUEST ROUTES
    // request post 
    app.post('/requests', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const requestData = req.body;
      const { donation_id, charity_email, isRequested } = requestData;

      try {
        // Check for existing request
        const existRequest = await requestsCollection.findOne({ donation_id, charity_email })
        if (existRequest) {
          return res.status(400).json({ message: 'You have already requested this donation.' });
        }
        // post requestData
        const result = await requestsCollection.insertOne({
          ...requestData,
          created_at: new Date()
        });

        res.status(201).json({ message: 'Request submitted successfully', insertedId: result.insertedId });
      } catch (error) {
        console.error('Error submitting donation request:', error);
        res.status(500).json({ message: 'Internal server error', error: error });
      }
    });


    // get data to check the double submission
    // Check if charity already requested this donation
    app.get('/requests/check', verifyFirebaseToken, async (req, res) => {
      const { donation_id, charity_email } = req.query;

      try {
        // Check if charity already requested this donation
        const exists = await requestsCollection.findOne({
          donation_id,
          charity_representative_email: charity_email,
        });

        // Check if donation is locked (accepted)
        const donation = await donationsCollection.findOne({ _id: new ObjectId(donation_id) });

        if (donation?.is_locked) {
          return res.status(400).json({
            message: 'This donation has already been accepted by another charity.',
            alreadyRequested: !!exists,
          });
        }

        // If not locked, respond with alreadyRequested status only
        res.status(200).json({ alreadyRequested: !!exists });
      } catch (error) {
        console.error('Error in request check:', error);
        res.status(500).json({ message: 'Internal server error', error: error });
      }
    });


    // GET /requests/restaurant - Get all requests for a restaurant's donations
    app.get('/requests/restaurant', verifyFirebaseToken, async (req, res) => {
      try {
        const userEmail = req?.decoded?.email;
        if (!userEmail) {
          return res.status(401).json({ message: 'Unauthorized: No email found in token.' });
        }

        // Fetch all requests where the restaurant_representative_email matches
        const requests = await requestsCollection
          .find({ restaurant_representative_email: userEmail })
          .sort({ created_at: -1 }) // optional: latest first
          .toArray();

        res.status(200).json(requests);
      } catch (error) {
        console.error('Error fetching restaurant requests:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // GET /requests/home/unique for charity email
    app.get('/requests/home_page', verifyFirebaseToken, verifyEmail, async (req, res) => {
      try {
        const requests = await requestsCollection.aggregate([
          // Sort by created_at descending
          { $sort: { created_at: -1 } },

          // Group by charity_email and collect top requests
          {
            $group: {
              _id: '$charity_email',
              topRequests: { $push: '$$ROOT' } // all requests, sorted
            }
          },

          // Slice to keep only top 2 per charity
          {
            $project: {
              _id: 0,
              charity_email: '$_id',
              topRequests: { $slice: ['$topRequests', 2] }
            }
          },

          // Flatten the topRequests array (1 document per request)
          { $unwind: '$topRequests' },

          // Replace root with the request data
          {
            $replaceRoot: {
              newRoot: '$topRequests'
            }
          },

          // Optional: Limit total result to 6
          { $limit: 8 }
        ]).toArray();


        res.status(200).json(requests);

      } catch (error) {
        console.error('Error fetching top requests:', error);
        res.status(500).json({ message: 'Server error while fetching top requests' });
      }
    });

    //requests patch for status change to accepted or rejected
    app.patch('/requests/status/:requestId', verifyFirebaseToken, async (req, res) => {
      const { requestId } = req.params;
      const { status, donation_id } = req.body; // Ensure donation_id is passed from frontend

      try {
        // Update the request status
        const result = await requestsCollection.updateOne(
          { _id: new ObjectId(requestId) },
          { $set: { request_status: status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Request not found.' });
        }

        // If status is 'Accepted', also lock the donation
        if (status === 'Accepted' && donation_id) {
          await donationsCollection.updateOne(
            { _id: new ObjectId(donation_id) },
            { $set: { is_locked: true } }
          );
        }

        res.status(200).json({ message: 'Request status updated successfully.' });
      } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({ message: 'Internal server error.' });
      }
    });

    // request patch for one accept, others will be rejected
    app.patch('/requests/reject-others/:donationId', verifyFirebaseToken, async (req, res) => {
      const { donationId } = req.params;
      const { except } = req.body;

      try {
        const result = await requestsCollection.updateMany(
          {
            donation_id: donationId,
            _id: { $ne: new ObjectId(except) },
            request_status: 'Pending',
          },
          { $set: { request_status: 'Rejected' } }
        );

        res.status(200).json({
          message: 'Other requests rejected.',
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error('Error rejecting other requests:', error);
        res.status(500).json({ message: 'Internal server error.' });
      }
    });

    // GET /requests/charity - Get all requests made by a charity (based on their email)
    app.get('/requests/charity', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { email } = req?.query;

      if (!email) {
        return res.status(400).json({ message: 'Missing charity representative email in query.' });
      }
      try {
        const requests = await requestsCollection
          .find({ charity_representative_email: email })
          .sort({ created_at: -1 }) // Optional: latest first
          .toArray();

        res.status(200).json(requests);
      } catch (error) {
        console.error(' Error fetching charity requests:', error);
        res.status(500).json({ message: 'Internal server error.' });
      }
    });

    // get /requests 
    app.get('/requests', verifyFirebaseToken, async (req, res) => {
      try {
        const { charity_representative_email, request_status, picking_status } = req.query;

        // Security check: ensure the requesting user matches the charity_email
        if (req?.decoded?.email !== charity_representative_email) {
          return res.status(403).json({ message: 'Forbidden: Email mismatch from get requests.' });
        }

        const query = {};
        if (charity_representative_email) query.charity_representative_email = charity_representative_email;
        if (request_status) query.request_status = request_status;
        if (picking_status) query.picking_status = picking_status;

        const requests = await requestsCollection.find(query).toArray();
        // console.log({ requests })
        res.status(200).json(requests);
      } catch (error) {
        console.error('Error fetching charity requests:', error);
        res.status(500).json({ message: 'Failed to fetch requests.' });
      }
    });


    // DELETE /requests/:id
    app.delete('/requests/:id', verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid request ID.' });
      }

      try {
        const result = await requestsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Request not found.' });
        }
        res.status(200).json({ message: 'Request deleted successfully.' });
      } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // PATCH /requests / confirm-pickup/:requestId
    app.patch('/requests/confirm-pickup/:requestId', verifyFirebaseToken, async (req, res) => {
      const { requestId } = req.params;

      if (!ObjectId.isValid(requestId)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }

      const _id = new ObjectId(requestId);

      try {
        // 1. Update the picking_status in the requests collection
        const requestUpdateResult = await requestsCollection.updateOne(
          { _id },
          { $set: { picking_status: 'Picked Up', picked_up_at: new Date() } }
        );

        // 2. Get the donation_id from the request
        const request = await requestsCollection.findOne({ _id });
        if (!request || !request.donation_id) {
          return res.status(404).json({ message: 'Donation not found in request' });
        }

        // 3. Update the donation_status in the donations collection
        const donationUpdateResult = await donationsCollection.updateOne(
          { _id: new ObjectId(request.donation_id) },
          {
            $set: {
              donation_status: 'Picked Up',
              picked_up_by: {
                charity_name: request.charity_name,
                charity_email: request.charity_email,
                charity_representative_name: request.charity_representative_name,
                charity_representative_email: request.charity_representative_email
              },
              updated_at: new Date()
            }
          }
        );

        res.status(200).json({
          message: 'Pickup confirmed and donation status updated.',
          requestModified: requestUpdateResult.modifiedCount,
          donationModified: donationUpdateResult.modifiedCount
        });
      } catch (error) {
        console.error('Error confirming pickup:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });

    // GET: /requests/exist
    app.get('/requests/exist', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { donationId, email } = req.query;
      if (!donationId || !email) {
        return res.status(400).json({ message: 'Missing donationId or email in query.' });
      }

      try {
        const request = await requestsCollection.findOne({
          donation_id: donationId,
          charity_representative_email: email
        });
        res.status(200).json({ exists: !!request })
      } catch (error) {
        res.status(500).send({
          message: 'The charity request existance check failed.',
          error: error?.message
        })
      }
    })

    // REVIEWS
    // reviews post route
    app.post('/reviews', verifyFirebaseToken, async (req, res) => {
      try {
        const review = req.body;

        // Security check: user can only post review as themselves
        if (req.decoded.email !== review.reviewer_email) {
          return res.status(403).json({ message: 'Forbidden: email mismatch' });
        }

        review.created_at = new Date();

        const result = await reviewsCollection.insertOne(review);

        res.status(201).json({ message: 'Review submitted successfully', insertedId: result.insertedId });
      } catch (error) {
        console.error('Error inserting review:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error?.message });
      }
    });

    // GET / reviews by user 
    app.get('/reviews', verifyFirebaseToken, verifyEmail, async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).json({ message: 'Reviewer email is required.' });
        }

        const reviews = await reviewsCollection.aggregate([
          { $match: { reviewer_email: email } },
          { $sort: { restaurant_name: 1 } }
        ]).toArray();

        res.status(200).json(reviews);
      } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Failed to fetch reviews', error: error?.message });
      }
    });


    // DELETE/ review delete
    app.delete('/reviews/:reviewId', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { reviewId } = req.params;

      if (!ObjectId.isValid(reviewId)) {
        return res.status(400).json({ message: 'Invalid review ID format.' });
      }
      try {
        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(reviewId) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Review not found or already deleted.' });
        }
        res.status(200).json({ message: 'Review deleted successfully.' });
      } catch (error) {
        res.status(500).json({ message: 'Failed to delete review.', error: error?.message });
      }
    });

    // GET /reviews/by-donation/:donationId
    app.get('/reviews/:donationId', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { donationId } = req.params;

      if (!donationId) {
        return res.status(400).json({ message: 'Donation ID is required' });
      }

      try {
        const reviews = await reviewsCollection
          .find({ donation_id: donationId })
          .sort({ created_at: -1 }) // Latest first
          .toArray();

        res.status(200).json(reviews);
      } catch (error) {
        res.status(500).json({
          message: 'Failed to fetch reviews',
          error: error.message,
        });
      }
    });

    // FAVORITES
    // post favorites
    app.post('/favorites', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const favorite = req.body;
      const donationId = favorite?.donationId;
      const favoriter_email = favorite?.favoriter_email;
      try {
        const already = await favoritesCollection.findOne({ favoriter_email, donationId });
        if (already) {
          return res.status(409).json({ message: "Already favorited by this user." })
        }
        const result = await favoritesCollection.insertOne(favorite);
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: 'Failed to post favorite.', error: error?.message })
      }
    });

    // get favorites by user email
    app.get(`/favorites/user`, verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { email } = req.query;
      if (!email) {
        return res.status(400).send({ message: 'Email query parameter is required' });
      }
      try {
        const favorites = await favoritesCollection.find({ favoriter_email: email }).toArray();
        res.status(200).send(favorites)
      } catch (error) {
        res.status(500).send({ message: 'Failed to find favorites by user email!', error: error?.message })
      }
    });
    // get is already favorited
    app.get('/favorites/is_favorited', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { donationId, email } = req.query;
      if (!email) {
        return res.status(400).send({ message: 'Email query parameter is required' });
      }
      try {
        const favorited = await favoritesCollection.findOne({ favoriter_email: email, donationId });
        res.status(200).json({ favorited: !!favorited })
      } catch (error) {
        res.status(500).send({ message: 'Failed to find favorite by user email!', error: error?.message })
      }
    });
    // delete favorite
    app.delete('/favorites/remove', verifyFirebaseToken, verifyEmail, async (req, res) => {
      const { id } = req.query;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid favorite ID format.' });
      }

      try {
        const _id = new ObjectId(id);
        const result = await favoritesCollection.deleteOne({ _id });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Favorite not found or already deleted.' });
        }

        res.status(200).json({ message: 'Favorite successfully deleted.' });
      } catch (error) {
        res.status(500).json({ message: 'Failed to delete favorite.', error: error?.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally { }
}
run().catch(console.dir);

// connection
app.get('/ping', (req, res) => {
  res.send('Server is live');
});
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
app.get('/', (req, res) => {
  res.send(html)
});
app.listen(port, (req, res) => {
  console.log(`flexora is running on the port: ${port}`)
})