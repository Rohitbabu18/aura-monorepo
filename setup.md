# To run the project
1. Install the requirements ( Do ChatGPT how can I install below things in my window/mac ) 
    - node 
    - npm
    - postgresql 

    Note: After npm install please do run below command
      > npm install

2. Verify if they installed or not ( Do ChatGPT how can I verify below things installed or not in my window/mac ) 

3. Create .env file and paste below content
```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/mobile_app
JWT_SECRET=supersecretkey
```

4. Check if Postgres is running, run below command
  pg_isready
5. To run the project

  npm run dev 