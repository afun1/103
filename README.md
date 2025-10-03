# 🎬 Sparky Screen Recorder

Professional screen recording application with Vimeo integration and customer management.

## ✨ Features

- **Professional Screen Recording** - High-quality video capture with audio
- **Vimeo Integration** - Direct upload to Vimeo with metadata
- **Customer Management** - Search and manage customer recordings
- **Audio Controls** - Real-time gain control and level monitoring  
- **Responsive Design** - Works on desktop and mobile devices
- **User Authentication** - Secure access with profile management

## 🚀 Quick Start

### Deploy to Vercel

1. **Clone this repository**
   ```bash
   git clone https://github.com/afun1/102.git
   cd 102
   ```

2. **Deploy to Vercel**
   ```bash
   npx vercel
   ```

3. **Add Environment Variables**
   In your Vercel dashboard, add:
   - `VIMEO_ACCESS_TOKEN`
   - `VIMEO_CLIENT_ID`
   - `VIMEO_CLIENT_SECRET`

4. **Visit your deployed app** 🎉

### Local Development

```bash
npm install
npm run dev
```

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Backend**: Vercel Serverless Functions
- **Video API**: Vimeo API v3.4
- **Deployment**: Vercel

## 📝 Environment Variables

Create a `.env.local` file (for local development):

```env
VIMEO_ACCESS_TOKEN=your_vimeo_access_token
VIMEO_CLIENT_ID=your_vimeo_client_id
VIMEO_CLIENT_SECRET=your_vimeo_client_secret
```

## 🎯 API Endpoints

- `POST /api/upload-vimeo` - Upload video to Vimeo
- `GET /api/vimeo-folder/{id}` - Get videos from Vimeo folder
- `GET /api/all-user-videos/{email}` - Get user's recordings

## 🔧 Configuration

The app is configured to upload videos to Vimeo folder ID `26555277`. 
Update this in the API functions if needed.

## 📄 License

MIT License - see LICENSE file for details.