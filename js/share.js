// 解析 URL 参数并添加预设的祝福语
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedTexts = urlParams.getAll('bless');
    
    if (sharedTexts.length > 0) {
        sharedTexts.forEach(text => {
            if (text && text.length <= 8 && customWords.size < 2) {
                customWords.add(text);
                wordDotsMap[text] = MyMath.literalLattice(text, 3, "Gabriola,华文琥珀", "90px");
            }
        });
        updateCustomTextList();
    }
}

// 分享功能
function shareFireworks() {
    const customTextsArray = Array.from(customWords);
    // if (customTextsArray.length === 0) {
    //     showToast('请先添加祝福语再分享');
    //     return;
    // }
    
    const baseUrl = window.location.origin + window.location.pathname;
    const params = customTextsArray.map(text => `bless=${encodeURIComponent(text)}`).join('&');
    const shareUrl = `${baseUrl}?${params}`;
    
    // 复制链接到剪贴板
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('分享链接已复制到剪贴板');
    }).catch(() => {
        showToast('复制失败，请手动复制链接');
    });
}

// 显示提示信息
function showToast(message) {
    let toast = document.querySelector('.share-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'share-toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2000);
}