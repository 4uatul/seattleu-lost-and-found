# Learn AWS by Building: SeattleU Lost & Found

> This guide teaches you AWS from the ground up. Every section explains **what** a service is, **why** it exists, **how** it works conceptually, and **then** you build it. Don't skip the reading — the understanding is what gets you the SA job, not the deployment.

---

## MODULE 1: How the Cloud Actually Works

Before touching any service, understand what you're working with.

### What is a Region?

AWS has data centers all over the world. A **Region** is a cluster of data centers in one geographic area — like `us-west-2` (Oregon) or `eu-west-1` (Ireland).

**Why does this matter?** Every resource you create lives in a specific region. If your users are in Seattle, you want `us-west-2` because it's physically closest — lower latency. If you accidentally create your database in `ap-southeast-1` (Singapore), your Seattle users would wait 150ms+ for every query instead of 5ms.

**SA interview point:** Customers ask "which region should I use?" constantly. The answer is always: closest to your users, unless compliance requires a specific region (e.g., healthcare data must stay in the US).

### What is an Availability Zone (AZ)?

Inside each region, there are 2-6 **Availability Zones** — separate physical buildings with independent power, cooling, and networking. `us-west-2` has `us-west-2a`, `us-west-2b`, `us-west-2c`, `us-west-2d`.

**Why does this matter?** If a building catches fire or loses power, only one AZ goes down. If your app runs in multiple AZs, it survives. This is called **high availability**.

**For our project:** We're using single-AZ because 100 students don't need 99.99% uptime. But you need to be able to explain: "If this grew, I'd distribute across AZs for fault tolerance."

### Exercise: Explore the console

1. Log into the AWS Console
2. Click the region dropdown (top right) — notice all the regions
3. Switch to `us-west-2` (Oregon) — this is where we'll build everything
4. Go to EC2 dashboard → look at the AZ selector — see how `us-west-2a`, `us-west-2b` etc. appear

---

## MODULE 2: VPC — Your Private Network in the Cloud

### The concept

Imagine you're building an office building. Before you put desks and computers in it, you need to design the floor plan — where the walls go, which rooms connect to the hallway, which rooms are locked away from visitors.

A **VPC (Virtual Private Cloud)** is your floor plan in AWS. It's an isolated private network that belongs only to you. Nothing outside your VPC can reach anything inside it unless you explicitly allow it.

### Key vocabulary

**CIDR Block** — The IP address range for your VPC. `10.0.0.0/16` means "I want 65,536 IP addresses starting from 10.0.0.0." The `/16` is a mask that determines how many addresses you get.

Think of it like a zip code. `10.0.0.0/16` is the whole city. You'll carve it into neighborhoods (subnets).

| CIDR | Number of IPs | Analogy |
|------|--------------|---------|
| /16 | 65,536 | The whole city |
| /24 | 256 | One neighborhood |
| /28 | 16 | One house |

**Subnet** — A subdivision of your VPC's IP range. Each subnet lives in exactly one AZ.

- **Public subnet** = has a route to the internet (like a storefront facing the street)
- **Private subnet** = no internet route (like a back office that only employees can enter)

**Internet Gateway (IGW)** — The front door of your VPC. It connects your VPC to the public internet. Without it, nothing in your VPC can reach the internet, and nobody on the internet can reach your VPC.

**Route Table** — A set of rules that say "if traffic is going to X, send it through Y."

For a public subnet, the route table says:
```
Destination        Target
10.0.0.0/16       local          (traffic within the VPC stays in the VPC)
0.0.0.0/0         igw-xxxxx      (everything else goes to the internet gateway)
```

For a private subnet, the route table says:
```
Destination        Target
10.0.0.0/16       local          (traffic within the VPC stays in the VPC)
                                  (no internet route — that's what makes it private)
```

**NAT Gateway** — A service that lets private subnet resources reach the internet (for updates, patches) without being reachable FROM the internet. Like a one-way mirror.

**For our project:** We're skipping NAT Gateway ($32/month). Our EC2 is in the public subnet so it can reach the internet directly. RDS is in the private subnet because databases should never be publicly accessible.

### Why two private subnets?

RDS has an AWS requirement: you must create a **DB Subnet Group** with subnets in at least 2 AZs, even if your database is single-AZ. This is because AWS wants you to be able to switch to Multi-AZ later without rebuilding. So we create two private subnets in different AZs.

### Visual model

```
                    Internet
                       |
                  [Internet Gateway]
                       |
              ┌────────────────────┐
              │       VPC          │
              │   10.0.0.0/16      │
              │                    │
              │  ┌──────────────┐  │
              │  │ Public Subnet│  │   ← EC2 lives here (can reach internet)
              │  │ 10.0.1.0/24 │  │
              │  │ (us-west-2a) │  │
              │  └──────────────┘  │
              │         |          │
              │  ┌──────────────┐  │
              │  │Private Sub 1 │  │   ← RDS lives here (no internet access)
              │  │ 10.0.2.0/24 │  │
              │  │ (us-west-2a) │  │
              │  └──────────────┘  │
              │                    │
              │  ┌──────────────┐  │
              │  │Private Sub 2 │  │   ← Required for RDS subnet group
              │  │ 10.0.3.0/24 │  │
              │  │ (us-west-2b) │  │
              │  └──────────────┘  │
              └────────────────────┘
```

### Hands-on: Build it manually first

**Do NOT use CloudFormation yet.** Build it by hand in the console so you understand what each piece does.

1. **Create the VPC**
   - Go to VPC Dashboard → Your VPCs → Create VPC
   - Name: `seattleu-lf-vpc`
   - IPv4 CIDR: `10.0.0.0/16`
   - Click Create

2. **Create the Internet Gateway**
   - Go to Internet Gateways → Create
   - Name: `seattleu-lf-igw`
   - After creation, click Actions → Attach to VPC → select your VPC

3. **Create the public subnet**
   - Go to Subnets → Create
   - Name: `seattleu-lf-public`
   - VPC: select your VPC
   - AZ: `us-west-2a`
   - CIDR: `10.0.1.0/24`
   - After creation: select it → Actions → Edit subnet settings → Enable "Auto-assign public IPv4 address"

4. **Create private subnet 1**
   - Name: `seattleu-lf-private-1`
   - VPC: your VPC
   - AZ: `us-west-2a`
   - CIDR: `10.0.2.0/24`

5. **Create private subnet 2**
   - Name: `seattleu-lf-private-2`
   - VPC: your VPC
   - AZ: `us-west-2b`
   - CIDR: `10.0.3.0/24`

6. **Create route table for public subnet**
   - Go to Route Tables → Create
   - Name: `seattleu-lf-public-rt`
   - VPC: your VPC
   - After creation: click the route table → Routes tab → Edit routes → Add route:
     - Destination: `0.0.0.0/0`
     - Target: your Internet Gateway
   - Then: Subnet Associations tab → Edit → Associate your public subnet

7. **Verify**
   - Your public subnet should show the route table with the IGW route
   - Your private subnets should have the default route table (VPC local traffic only)

### Knowledge check (answer these before moving on)

- Why does the public subnet have a route to `0.0.0.0/0` through the IGW?
- What would happen if you removed that route?
- Why is the RDS in a private subnet?
- What's the difference between a security group and a subnet being "private"?
- If a hacker gets into your EC2, can they reach the RDS? Why or why not?

### Now automate it: CloudFormation

Now that you understand every piece, delete everything you just created (VPC dashboard → delete VPC, which cascades and deletes subnets, route tables, etc.), and recreate it using CloudFormation.

**What is CloudFormation?**

CloudFormation is "infrastructure as code." Instead of clicking through the console, you write a YAML file describing what you want, and AWS creates it all for you. Benefits:

- **Repeatable** — deploy the same stack in any region with one command
- **Trackable** — the template is in Git, so you can see who changed what and when
- **Teardown** — delete the whole stack with one command, no orphaned resources

Create `infra/vpc.yaml` — but this time, write it yourself. Use the reference below only if you get stuck. The structure is:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: <what this template creates>

Parameters:
  # Variables you can pass in at deploy time

Resources:
  # The AWS resources to create (VPC, subnets, IGW, route tables, associations)

Outputs:
  # Values other stacks can reference (VPC ID, subnet IDs)
```

**Your task:** Write the template that creates everything you just built manually. The key resources you need:

- `AWS::EC2::VPC`
- `AWS::EC2::InternetGateway`
- `AWS::EC2::VPCGatewayAttachment`
- `AWS::EC2::Subnet` (x3)
- `AWS::EC2::RouteTable` (x2 — public and private)
- `AWS::EC2::Route` (public route to IGW)
- `AWS::EC2::SubnetRouteTableAssociation` (x3)

Look up each resource type in the [CloudFormation docs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-ec2-vpc.html). Reading docs is an SA skill.

Deploy it:
```bash
aws cloudformation create-stack \
  --stack-name seattleu-lf-vpc \
  --template-body file://infra/vpc.yaml \
  --region us-west-2
```

If it fails, check:
```bash
aws cloudformation describe-stack-events \
  --stack-name seattleu-lf-vpc \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

Read the error, fix the YAML, delete the stack, redeploy. This debug cycle is how you learn.

---

## MODULE 3: Security Groups — Your Firewall Rules

### The concept

A security group is a virtual firewall around an AWS resource. It controls what traffic can come IN (ingress) and what can go OUT (egress).

Think of it like a bouncer at a club:
- **Inbound rules** = who can come in (and through which door/port)
- **Outbound rules** = who can leave (by default, all outbound is allowed)

Key properties:
- Security groups are **stateful** — if you allow traffic in, the response is automatically allowed out
- Rules are **allow-only** — you can't write "deny" rules, you can only add "allow" rules
- By default, a new security group allows NO inbound traffic and ALL outbound traffic

### What our project needs

**EC2 Security Group:**
```
Inbound:
  Port 22  (SSH)    — from YOUR IP only (not 0.0.0.0/0 in production!)
  Port 80  (HTTP)   — from anywhere (users access the API through nginx)
  Port 443 (HTTPS)  — from anywhere

Outbound:
  All traffic — default, EC2 needs to reach RDS, S3, internet for updates
```

**RDS Security Group:**
```
Inbound:
  Port 5432 (PostgreSQL) — from EC2 Security Group ONLY (not from an IP, from the SG itself)

Outbound:
  All traffic — default
```

**Why reference the EC2 Security Group instead of an IP?**

If the EC2's IP changes (reboot, replace instance), an IP-based rule breaks. By referencing the security group, you're saying "anything that belongs to the EC2 security group can connect." This is more resilient and more secure.

### Hands-on: Build it manually

1. **Create EC2 Security Group**
   - Go to VPC → Security Groups → Create
   - Name: `seattleu-lf-ec2-sg`
   - VPC: your VPC
   - Inbound rules:
     - SSH (22) from My IP
     - HTTP (80) from 0.0.0.0/0
     - HTTPS (443) from 0.0.0.0/0
   - Leave outbound as default (all traffic)

2. **Create RDS Security Group**
   - Name: `seattleu-lf-rds-sg`
   - VPC: your VPC
   - Inbound rules:
     - PostgreSQL (5432) from `seattleu-lf-ec2-sg` (select the security group, not an IP)
   - Leave outbound as default

3. **Verify by thinking through these scenarios:**
   - Can someone on the internet reach your RDS? (No — RDS SG only allows traffic from EC2 SG)
   - Can your EC2 reach the RDS? (Yes — EC2 is in the EC2 SG, which is allowed on port 5432)
   - Can someone SSH into your EC2 from a coffee shop in Tokyo? (Only if their IP matches your "My IP" rule)

### Knowledge check

- What's the difference between a security group and a network ACL?
- Why are security groups "stateful" and why does that matter?
- If you add a rule allowing port 5432 from the EC2 security group, do you also need an outbound rule on the EC2 SG for port 5432? Why or why not?
- In production, why would you never allow SSH from 0.0.0.0/0?

### Now automate it

Delete the security groups, write `infra/security-groups.yaml`. Key CloudFormation resources:

- `AWS::EC2::SecurityGroup` (x2)

The tricky part: the RDS security group references the EC2 security group using `SourceSecurityGroupId: !Ref EC2SecurityGroup`. This is CloudFormation's way of saying "allow traffic from that other security group."

Use `!ImportValue` with the `Fn::Sub` function to reference the VPC ID from your vpc.yaml stack's outputs.

---

## MODULE 4: RDS — Managed Databases

### The concept

You could install PostgreSQL on your EC2 instance. So why use RDS?

**RDS (Relational Database Service)** is a managed database. AWS handles:
- Automated backups (daily snapshots)
- Software patching
- Failover (if you enable Multi-AZ)
- Monitoring
- Storage scaling

If you installed PostgreSQL on EC2, YOU would handle all of that. For a production app, that's a full-time job.

### Key RDS concepts

**Instance class** — The size of the machine running your database.
- `db.t3.micro` = 2 vCPUs, 1GB RAM. Free tier eligible. Handles our 100 users easily.
- `db.r6g.large` = what you'd use for thousands of concurrent users

**Storage** — How much disk space. We'll use 20GB (free tier max). `gp2` is general purpose SSD.

**Multi-AZ** — AWS creates a standby replica in another AZ. If the primary fails, AWS automatically switches to the standby. You DON'T need this for 100 users.

**DB Subnet Group** — Tells RDS "put my database in one of these subnets." Must include subnets in at least 2 AZs (AWS requirement).

**Parameter: PubliclyAccessible**
- `true` = database gets a public IP, reachable from the internet (NEVER do this in production)
- `false` = only reachable from within the VPC (what we want)

### How data flows

```
User → CloudFront → S3 (React app loads)
User → EC2 (nginx → Flask) → RDS (PostgreSQL)
```

The user never talks to RDS directly. Flask connects to RDS using a connection string:
```
postgresql://username:password@rds-endpoint:5432/database_name
```

### Hands-on: Build it manually

1. **Create a DB Subnet Group**
   - Go to RDS → Subnet Groups → Create
   - Name: `seattleu-lf-db-subnets`
   - VPC: your VPC
   - Add your two private subnets (us-west-2a and us-west-2b)

2. **Launch the RDS instance**
   - Go to RDS → Create Database
   - Choose "Standard Create"
   - Engine: PostgreSQL
   - Version: 15.x (latest 15)
   - Template: Free tier
   - DB instance identifier: `seattleu-lf-db`
   - Master username: `lostfoundadmin`
   - Master password: set something secure
   - Instance class: `db.t3.micro`
   - Storage: 20GB, gp2
   - **Connectivity:**
     - VPC: your VPC
     - Subnet group: `seattleu-lf-db-subnets`
     - Public access: NO
     - Security group: select `seattleu-lf-rds-sg`
   - Click Create (takes 5-10 minutes)

3. **Test connectivity**
   - SSH into your EC2
   - Install PostgreSQL client: `sudo yum install -y postgresql15` (Amazon Linux) or `sudo apt install -y postgresql-client` (Ubuntu)
   - Connect: `psql -h YOUR_RDS_ENDPOINT -U lostfoundadmin -d postgres`
   - If you get a prompt, it works. If it hangs, check your security group rules.

4. **Create the database and tables**
   ```sql
   CREATE DATABASE lostfound;
   \c lostfound

   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       cognito_sub VARCHAR(255) UNIQUE NOT NULL,
       email VARCHAR(255) UNIQUE NOT NULL,
       full_name VARCHAR(255),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE items (
       id SERIAL PRIMARY KEY,
       title VARCHAR(255) NOT NULL,
       description TEXT,
       category VARCHAR(50) NOT NULL,
       status VARCHAR(20) DEFAULT 'open',
       item_type VARCHAR(10) NOT NULL,
       location VARCHAR(255),
       date_occurred DATE NOT NULL,
       image_url VARCHAR(500),
       reporter_id INTEGER REFERENCES users(id),
       claimer_id INTEGER REFERENCES users(id),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Test it
   INSERT INTO users (cognito_sub, email, full_name) VALUES ('test-sub', 'test@seattleu.edu', 'Test User');
   SELECT * FROM users;
   ```

### Knowledge check

- Why is RDS in a private subnet instead of a public one?
- What does Multi-AZ actually do at the infrastructure level? (Hint: synchronous replication to a standby)
- If you needed to connect to RDS from your laptop for debugging, how would you do it without making it publicly accessible? (Hint: SSH tunnel through EC2)
- What's the difference between RDS and Aurora?
- Why would you choose PostgreSQL over DynamoDB for this app? (Hint: think about the data relationships)

### Now automate it

Delete the RDS instance and subnet group, write `infra/rds.yaml`. Key resources:

- `AWS::RDS::DBSubnetGroup`
- `AWS::RDS::DBInstance`

Use `NoEcho: true` for the password parameter so it doesn't show in CloudFormation console.

---

## MODULE 5: EC2 — Your Virtual Server

### The concept

EC2 (Elastic Compute Cloud) is a virtual machine in the cloud. You pick the OS, the size, and you get a server you can SSH into and run whatever you want.

### Key concepts

**AMI (Amazon Machine Image)** — The operating system template. Like choosing Windows or Mac when buying a laptop, except you're choosing Amazon Linux, Ubuntu, etc. We'll use Amazon Linux 2 because it's optimized for AWS and free tier eligible.

**Instance Type** — The hardware specs.
- `t2.micro` = 1 vCPU, 1GB RAM. Free tier. Enough for our Flask API.
- The "t" family is "burstable" — you get a baseline performance and can "burst" above it temporarily. Perfect for apps with variable traffic like ours.

**Key Pair** — Your SSH credentials. AWS generates a public/private key pair. The public key goes on the EC2, you keep the private key (.pem file). Without it, you can't SSH in.

**User Data** — A bash script that runs when the instance first boots. Use it to install software automatically.

**Elastic IP** — A static public IP. Without one, your EC2 gets a new IP every time it stops and starts. For our project, this matters because your frontend needs to know where the API is.

### Why public subnet for EC2?

Our EC2 is in the public subnet because:
1. Users need to reach the API (HTTP/HTTPS traffic)
2. The EC2 needs internet access to install packages, pull from Git
3. We're skipping the NAT Gateway to stay on free tier

In production, the EC2 would be in a private subnet behind an ALB, with a NAT Gateway for outbound internet access. Know this for the interview.

### Hands-on: Build it manually

1. **Create a Key Pair**
   - Go to EC2 → Key Pairs → Create
   - Name: `seattleu-lf-key`
   - Type: RSA
   - Format: `.pem`
   - Download and save. Run `chmod 400 seattleu-lf-key.pem`

2. **Launch the instance**
   - Go to EC2 → Launch Instance
   - Name: `seattleu-lf-api`
   - AMI: Amazon Linux 2023 (free tier eligible)
   - Instance type: `t2.micro`
   - Key pair: `seattleu-lf-key`
   - Network settings:
     - VPC: your VPC
     - Subnet: your public subnet
     - Auto-assign public IP: Enable
     - Security group: select `seattleu-lf-ec2-sg`
   - User Data (under Advanced Details):
     ```bash
     #!/bin/bash
     yum update -y
     yum install -y python3 python3-pip git nginx
     pip3 install flask flask-cors sqlalchemy psycopg2-binary boto3 python-jose requests gunicorn
     ```
   - Launch

3. **SSH in and explore**
   ```bash
   ssh -i seattleu-lf-key.pem ec2-user@YOUR_PUBLIC_IP
   ```

   Once in:
   ```bash
   # Check what's installed
   python3 --version
   flask --version
   nginx -v

   # Check your network
   curl http://169.254.169.254/latest/meta-data/public-ipv4
   # This is the EC2 metadata service — how instances learn about themselves

   # Test that you can reach the internet
   ping google.com

   # Test that you can reach RDS
   psql -h YOUR_RDS_ENDPOINT -U lostfoundadmin -d lostfound
   ```

4. **Run a test Flask app**
   ```bash
   cat > test_app.py << 'EOF'
   from flask import Flask
   app = Flask(__name__)

   @app.route('/api/health')
   def health():
       return {'status': 'healthy'}

   if __name__ == '__main__':
       app.run(host='0.0.0.0', port=5000)
   EOF

   python3 test_app.py &

   # Test locally
   curl http://localhost:5000/api/health

   # Test from outside (from YOUR laptop, not the EC2)
   # This will FAIL because security group only allows port 80/443, not 5000
   # That's correct — nginx will proxy port 80 → 5000
   ```

### Understanding nginx as a reverse proxy

**Why not just expose Flask on port 80?**

Flask's built-in server is for development. It can't handle concurrent requests well, doesn't do HTTPS, and running on port 80 requires root privileges. Nginx is purpose-built for this:

```
User's browser → port 80 → nginx → port 5000 → Flask
```

Nginx handles:
- Serving on port 80 (HTTP) and 443 (HTTPS)
- Concurrent connections efficiently
- Static file serving
- Request buffering

5. **Set up nginx**
   ```bash
   sudo vim /etc/nginx/conf.d/lostfound.conf
   ```

   ```nginx
   server {
       listen 80;
       server_name _;

       location /api/ {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

   ```bash
   sudo nginx -t          # test config — should say "syntax is ok"
   sudo systemctl restart nginx
   
   # Now test from your laptop browser:
   # http://YOUR_EC2_IP/api/health → should return {"status": "healthy"}
   ```

### Knowledge check

- What happens to your EC2's public IP if you stop and start (not restart) the instance?
- What is the EC2 metadata service (169.254.169.254) and why do SAs care about it?
- Why is t2.micro called "burstable"? What happens when you exhaust your CPU credits?
- Why is nginx better than running Flask directly on port 80?
- If your Flask app crashes, what happens? How would you make it auto-restart? (Hint: systemd)

### Now automate it

Terminate the instance and write `infra/ec2.yaml`. Key resources:

- `AWS::EC2::Instance`

The UserData section is important — it's the bootstrap script that installs everything when the instance launches.

---

## MODULE 6: S3 — Object Storage

### The concept

S3 (Simple Storage Service) stores files (called "objects") in containers (called "buckets"). It's not a file system — it's object storage. Every object has a key (like a file path) and a value (the file data).

S3 is used for everything:
- Static website hosting (your React app)
- File storage (item photos)
- Data lakes
- Backups
- Log storage

### Key concepts for our project

**Bucket** — A container for objects. Bucket names are globally unique across ALL AWS accounts. That's why we append the account ID.

**Static website hosting** — S3 can serve files as a website. Put `index.html` in a bucket, enable website hosting, and it's live. We use this for the React frontend.

**Pre-signed URLs** — A temporary URL that grants permission to upload or download a specific object. Instead of routing image uploads through your server (which uses EC2 bandwidth), the user uploads directly to S3.

Flow:
```
1. Frontend calls your API: GET /api/upload-url?filename=phone.jpg
2. Flask generates a pre-signed PUT URL using boto3 (valid for 5 minutes)
3. Frontend receives the URL and PUTs the image directly to S3
4. Frontend saves the resulting S3 URL with the item
```

**Why pre-signed URLs instead of uploading through EC2?**

If 20 students upload 5MB photos at the same time, that's 100MB flowing through your t2.micro. Pre-signed URLs offload that to S3, which can handle unlimited concurrent uploads.

**CloudFront** — A CDN (Content Delivery Network) that caches your S3 content at edge locations worldwide. For the frontend, CloudFront gives you:
- HTTPS (S3 website hosting is HTTP only)
- Faster load times (cached at an edge near Seattle)
- Custom domain support later

### Hands-on: Build it manually

1. **Create the images bucket**
   - Go to S3 → Create bucket
   - Name: `seattleu-lf-images-YOUR_ACCOUNT_ID`
   - Region: us-west-2
   - Uncheck "Block all public access" (images need to be publicly readable)
   - Create

2. **Add a bucket policy for public read access**
   - Click the bucket → Permissions → Bucket Policy
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadImages",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::seattleu-lf-images-YOUR_ACCOUNT_ID/items/*"
       }
     ]
   }
   ```
   This allows anyone to VIEW images (they need the URL), but only your API can UPLOAD (via pre-signed URLs that require AWS credentials).

3. **Add CORS configuration**
   - Permissions → CORS
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedOrigins": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   This lets the browser upload directly to S3 from your React app. Without CORS, the browser would block the request.

4. **Test a pre-signed URL from EC2**
   ```bash
   # SSH into EC2
   python3 << 'EOF'
   import boto3
   s3 = boto3.client('s3', region_name='us-west-2')
   url = s3.generate_presigned_url(
       'put_object',
       Params={
           'Bucket': 'seattleu-lf-images-YOUR_ACCOUNT_ID',
           'Key': 'items/test.jpg',
           'ContentType': 'image/jpeg'
       },
       ExpiresIn=300
   )
   print(url)
   EOF
   ```
   This will fail with an access denied if your EC2 doesn't have an IAM role with S3 permissions. That's the next lesson — IAM.

5. **Create the frontend bucket**
   - Same process, name: `seattleu-lf-frontend-YOUR_ACCOUNT_ID`
   - Properties → Static website hosting → Enable
   - Index document: `index.html`
   - Error document: `index.html` (for React client-side routing)

6. **Create CloudFront distribution**
   - Go to CloudFront → Create Distribution
   - Origin: your frontend S3 bucket's website endpoint
   - Viewer protocol: Redirect HTTP to HTTPS
   - Default root object: `index.html`
   - Create (takes 5-10 minutes to deploy globally)

### Knowledge check

- What's the difference between S3 website hosting endpoint and the regular S3 endpoint?
- Why do we need CORS on the images bucket?
- What happens when a pre-signed URL expires? Can someone reuse it?
- Why use CloudFront instead of just the S3 website URL?
- If your React app has client-side routing (like `/items/123`), what happens when someone refreshes the page? Why do we set the error document to `index.html`?

---

## MODULE 7: IAM — Permissions and Access Control

### The concept

IAM (Identity and Access Management) controls WHO can do WHAT on WHICH resources.

Every API call to AWS must be authenticated and authorized. When you use the console, your login credentials handle this. When your EC2 needs to access S3, it needs credentials too.

### Key concepts

**IAM Role** — An identity that AWS services can assume. Instead of putting access keys on your EC2 (dangerous — anyone who hacks the instance gets your keys), you assign a role TO the EC2. The EC2 automatically gets temporary credentials that rotate.

**IAM Policy** — A JSON document that defines permissions. Attached to roles, users, or groups.

**Principle of Least Privilege** — Only grant the permissions actually needed. If your EC2 only needs to put objects in one S3 bucket, don't give it `s3:*` on `*`.

### What our EC2 needs

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::seattleu-lf-images-YOUR_ACCOUNT_ID/items/*"
    }
  ]
}
```

This says: "This role can upload and download objects, but ONLY in the `items/` prefix of this specific bucket." If someone compromises your EC2, they can't read or delete your other S3 buckets.

### Hands-on

1. **Create the IAM Role**
   - Go to IAM → Roles → Create
   - Trusted entity: AWS Service → EC2
   - Create a new inline policy with the JSON above (replace the bucket name)
   - Name the role: `seattleu-lf-ec2-role`

2. **Attach to your EC2**
   - Go to EC2 → select your instance → Actions → Security → Modify IAM Role
   - Select `seattleu-lf-ec2-role`
   - Save

3. **Test from EC2**
   ```bash
   # SSH into EC2
   # This should now work:
   python3 << 'EOF'
   import boto3
   s3 = boto3.client('s3', region_name='us-west-2')
   url = s3.generate_presigned_url(
       'put_object',
       Params={'Bucket': 'seattleu-lf-images-YOUR_ACCOUNT_ID', 'Key': 'items/test.jpg', 'ContentType': 'image/jpeg'},
       ExpiresIn=300
   )
   print("Pre-signed URL:", url[:80], "...")
   print("Success! EC2 has S3 permissions via IAM role.")
   EOF
   ```

### Knowledge check

- Why use IAM roles instead of access keys on EC2?
- What does "least privilege" mean in practice for this project?
- What's the difference between an IAM role and an IAM user?
- If you wanted the EC2 to also read from RDS parameter store for secrets, what would you add to the policy?

---

## MODULE 8: Cognito — Authentication

### The concept

Cognito is managed authentication. Instead of building login/signup yourself (password hashing, email verification, forgot password, token management), Cognito handles it all.

### Key concepts

**User Pool** — A user directory. Stores usernames, passwords, email addresses. Handles sign-up, sign-in, password recovery.

**Hosted UI** — A pre-built login/signup page that Cognito hosts for you. You redirect users to it, they sign in, and they get redirected back with tokens. This saves you from building login forms.

**Tokens** — After login, Cognito returns three tokens:
- **ID Token** — Contains user info (email, name, sub). This is what your API validates.
- **Access Token** — Used to call Cognito APIs (change password, etc.)
- **Refresh Token** — Used to get new ID/Access tokens when they expire

**Pre-sign-up Lambda trigger** — A function that runs BEFORE a user is created. We use it to check if the email ends with `@seattleu.edu`. If it doesn't, the function throws an error and the sign-up is rejected.

### The auth flow

```
1. User visits your React app
2. React redirects to Cognito Hosted UI (login page)
3. User enters @seattleu.edu email and password
4. Cognito's pre-sign-up Lambda checks the email domain
5. If valid, Cognito creates the user and redirects back to your app with an auth code
6. React exchanges the auth code for tokens (ID token, access token, refresh token)
7. React stores the ID token and sends it with every API request:
   Authorization: Bearer eyJraWQ...
8. Flask validates the ID token on every request using Cognito's public keys (JWKS)
```

### Hands-on

1. **Create the Lambda function first**
   
   Go to Lambda → Create function
   - Name: `seattleu-lf-email-check`
   - Runtime: Python 3.12
   - Code:
   ```python
   def handler(event, context):
       email = event['request']['userAttributes'].get('email', '')
       if not email.endswith('@seattleu.edu'):
           raise Exception('Only @seattleu.edu emails are allowed.')
       event['response']['autoConfirmUser'] = True
       event['response']['autoVerifyEmail'] = True
       return event
   ```
   - Deploy

2. **Create the User Pool**
   - Go to Cognito → Create User Pool
   - Sign-in: Email
   - Password policy: defaults are fine
   - MFA: No MFA (keep it simple)
   - Required attributes: email, name
   - Email: Send with Cognito (free tier)
   - App client name: `seattleu-lf-web`
   - Client secret: Don't generate (public web apps can't keep secrets)
   - Hosted UI: Enable
   - Cognito domain: `seattleu-lf-auth`
   - Callback URL: `http://localhost:3000/callback` (add CloudFront URL later)
   - Sign-out URL: `http://localhost:3000`
   - OAuth flows: Authorization code grant
   - Scopes: email, openid, profile
   - Lambda triggers → Pre sign-up: select your Lambda function

3. **Test the hosted UI**
   - Go to your User Pool → App integration → App clients → View Hosted UI
   - Try signing up with a @gmail.com email → should be rejected
   - Try signing up with a @seattleu.edu email → should succeed
   - After sign-up, check the URL you were redirected to — it contains the auth code

4. **Understanding the JWT**
   After login, you get an ID token. It's a JWT (JSON Web Token) that looks like:
   ```
   eyJraWQiOi... (header) . eyJzdWIiOi... (payload) . signature
   ```
   
   Decode it at jwt.io to see what's inside:
   ```json
   {
     "sub": "a1b2c3d4-...",      // unique user ID
     "email": "atul@seattleu.edu",
     "name": "Atul Bhardwaj",
     "iss": "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XXXXX",
     "exp": 1717200000            // expiration timestamp
   }
   ```

   Your Flask API validates this token on every request by:
   1. Getting Cognito's public keys (JWKS endpoint)
   2. Verifying the token's signature matches
   3. Checking the token isn't expired
   4. Checking the issuer matches your User Pool

### Knowledge check

- Why use Cognito instead of building auth yourself?
- What's the difference between the ID token and the access token?
- Why does the pre-sign-up trigger throw an exception to reject users instead of returning false?
- What happens when the ID token expires? How does the frontend get a new one?
- If someone steals an ID token, what can they do? How long does the risk last?

---

## MODULE 9: Putting It All Together

### The deployment order matters

```
1. VPC (everything lives inside this)
2. Security Groups (need VPC ID)
3. IAM Role (EC2 needs this to access S3)
4. RDS (needs VPC, private subnets, RDS security group)
5. S3 buckets (images and frontend)
6. EC2 (needs VPC, public subnet, EC2 security group, IAM role)
7. Lambda function (for Cognito trigger)
8. Cognito (needs Lambda ARN)
9. Configure nginx on EC2
10. Deploy Flask to EC2
11. Deploy React to S3
12. CloudFront (needs S3 frontend bucket)
```

### Full deployment exercise

**Goal:** Deploy the entire stack, make a request, tear it all down, and redeploy from scratch. If you can do that, you understand the infrastructure.

1. Deploy all CloudFormation stacks in order
2. SSH into EC2, set up nginx, deploy Flask
3. Create a test user in Cognito
4. Get a token from Cognito's hosted UI
5. Use that token to call your API:
   ```bash
   curl -H "Authorization: Bearer YOUR_ID_TOKEN" http://YOUR_EC2_IP/api/items
   ```
6. If you get back `[]` (empty list), everything works
7. Create an item:
   ```bash
   curl -X POST http://YOUR_EC2_IP/api/items \
     -H "Authorization: Bearer YOUR_ID_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title":"Lost iPhone","item_type":"lost","category":"electronics","date_occurred":"2026-05-01","location":"Library 2nd floor"}'
   ```
8. Verify it appears: `curl -H "Authorization: Bearer YOUR_ID_TOKEN" http://YOUR_EC2_IP/api/items`

### Teardown exercise

Delete everything in reverse order. Make sure no resources are orphaned. Check:
- No running EC2 instances
- No RDS instances
- No S3 buckets with objects (empty them first)
- No CloudFormation stacks in FAILED state
- No Elastic IPs allocated

Then redeploy everything from your CloudFormation templates. If it works cleanly from scratch, your IaC is solid.

---

## MODULE 10: The Architecture Story (Interview Prep)

### The 5-minute walkthrough

Practice saying this out loud:

"I built a lost and found platform for Seattle University students. Let me walk you through the architecture.

Users access a React frontend hosted on S3 behind CloudFront. Authentication goes through Cognito — I restricted sign-up to @seattleu.edu emails using a Lambda trigger on the pre-sign-up event.

The API is a Flask application running on a t2.micro EC2 instance in a public subnet, behind nginx as a reverse proxy. It talks to a PostgreSQL database on RDS in a private subnet — the security group only allows connections from the EC2 instance.

For image uploads, the API generates S3 pre-signed URLs so files go directly from the browser to S3 without flowing through the EC2.

Everything is defined in CloudFormation — I can deploy or tear down the entire stack with one command.

I made deliberate tradeoffs for the scale: 100 users don't need an ALB, Multi-AZ, or a NAT Gateway. But if this grew, I'd move the EC2 behind an ALB in a private subnet, enable Multi-AZ on RDS, and add an Auto Scaling Group."

### Questions you WILL be asked

Prepare answers for each:

1. "Why not use a serverless architecture?" (Lambda + API Gateway)
2. "How would you handle 10x traffic?"
3. "What happens if your EC2 goes down?"
4. "How do you handle secrets like the database password?"
5. "Walk me through a request from the user's browser to the database and back"
6. "What would you add for monitoring and alerting?"
7. "How would you do this differently with a $0 budget vs. a $10,000/month budget?"

---

## What to do next

After completing all modules:

1. **Write the architecture case study** in your docs/ folder
2. **Write one blog post** about a specific decision you made
3. **Practice the 5-minute walkthrough** until it's effortless
4. **Then** start the RAG chatbot (project #2) using what you've learned

The goal isn't to build a perfect app. The goal is to understand every AWS service deeply enough to explain it to a customer, defend your choices under pressure, and propose alternatives when the requirements change. That's what makes an SA.