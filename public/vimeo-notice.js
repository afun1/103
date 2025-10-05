// Vimeo API Status Notice for Static Deployment
function showVimeoNotice() {
    const notice = document.createElement('div');
    notice.innerHTML = `
        <div style="
            background: linear-gradient(45deg, #ff9a9e, #fecfef);
            color: #333;
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
            text-align: center;
            border: 2px solid rgba(255, 255, 255, 0.3);
        ">
            <h4 style="margin: 0 0 10px 0;">📢 Vimeo Integration Notice</h4>
            <p style="margin: 0;">
                🔧 <strong>Vimeo API features are currently unavailable in this static deployment.</strong><br>
                ✅ <strong>Screen recording works perfectly!</strong> Videos download to your computer.<br>
                💡 For full Vimeo upload functionality, deploy to a Node.js server environment.
            </p>
        </div>
    `;
    
    // Add to the top of the main container
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(notice, container.firstChild);
}

// Show notice when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(showVimeoNotice, 1000);
});