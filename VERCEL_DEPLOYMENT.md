# 🚀 Vercel Deployment Guide for Sparky Screen Recorder

## 📋 Prerequisites
1. **Vercel Account**: Sign up at https://vercel.com
2. **Vimeo API Keys**: From your Vimeo Developer dashboard
3. **Supabase Project** (optional): For user management

## 🔧 Step-by-Step Deployment

### 1. **Install Vercel CLI**
```bash
npm i -g vercel
```

### 2. **Login to Vercel**
```bash
vercel login
```

### 3. **Deploy Your Project**
```bash
# From your project root (c:\sr927c)
vercel --prod
```

### 4. **Set Environment Variables in Vercel Dashboard**
Go to your Vercel project → Settings → Environment Variables:

```
VIMEO_CLIENT_ID=your_vimeo_client_id
VIMEO_CLIENT_SECRET=your_vimeo_client_secret  
VIMEO_ACCESS_TOKEN=your_vimeo_access_token
VIMEO_FOLDER_ID=26555277
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### 5. **File Structure for Vercel**
```
c:\sr927c\
├── api/
│   ├── upload-vimeo.js           # Vimeo upload endpoint
│   └── all-user-videos/
│       └── [userEmail].js        # Get user videos with pagination
├── public/
│   ├── index.html                # Your main app
│   ├── global-header.js          # Header functionality  
│   └── Sparky-AItp.gif          # Logo
├── vercel.json                   # Vercel configuration
└── package.json                  # Dependencies

```

## 🎯 Key Differences from Local Development

### **1. API Routes**
- Local: `/api/upload-vimeo` → Express route
- Vercel: `/api/upload-vimeo.js` → Serverless function

### **2. File Uploads**
- Local: Uses temp files on disk
- Vercel: Uses memory buffers (no persistent filesystem)

### **3. Environment Variables**
- Local: `.env` file
- Vercel: Dashboard settings

### **4. Function Limits**
- **Timeout**: 60 seconds max (Hobby plan: 10s, Pro: 60s)
- **Memory**: 1GB max
- **Size**: 50MB max per video upload

## 🚨 Important Notes

### **Video Upload Size Limits**
- **Hobby Plan**: 10MB max video size
- **Pro Plan**: 50MB max video size  
- **Enterprise**: Higher limits available

### **Cold Starts**
First request may take 2-3 seconds to initialize

### **CORS Setup**
All API routes include CORS headers for cross-origin requests

## 🔄 Deployment Commands

### **Deploy to Production**
```bash
vercel --prod
```

### **Deploy to Preview**
```bash
vercel
```

### **Check Deployment Status**
```bash
vercel ls
```

### **View Logs**
```bash
vercel logs [deployment-url]
```

## 🎉 After Deployment

1. **Test Upload**: Record a short video and upload
2. **Check Thumbnails**: Verify all 32+ videos show with thumbnails
3. **Test Pagination**: Ensure all videos load (not just first 50)
4. **Monitor Performance**: Check function execution times

## 🐛 Troubleshooting

### **Common Issues:**
1. **Environment Variables**: Double-check all Vimeo API keys
2. **CORS Errors**: Ensure API routes include CORS headers
3. **Timeout Errors**: Large videos may exceed function timeout
4. **Memory Errors**: Videos over 50MB may cause memory issues

### **Debug Commands:**
```bash
# View function logs in real-time
vercel logs --follow

# Check environment variables
vercel env ls
```

## 📈 Monitoring

- **Vercel Dashboard**: Real-time function metrics
- **Error Logging**: Console logs available in Vercel dashboard
- **Performance**: Function execution time and memory usage

Your Sparky Screen Recorder will be live at: `https://your-project-name.vercel.app` 🚀