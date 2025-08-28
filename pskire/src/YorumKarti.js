import React from 'react';
import { Link } from 'react-router-dom';
import './css/YorumKarti.css';
import Swal from 'sweetalert2';

function YorumKarti({
    yorum,
    childYorumlar,
    onCevapla,
    onFormSubmit,
    onYorumKaldir, // onYorumSil -> onYorumKaldir olarak güncellendi
    onYorumSikayet,
    getProfilPath,
    formatDate,
    currentUser,
    replyingTo,
    cevapIcerik,
    setCevapIcerik,
    kaldirilanYorumlar,
    yorumGonderiliyor,
    getAuthActions // Parent component'ten gelen yetki fonksiyonu
}) {

    const isRemoved = kaldirilanYorumlar && kaldirilanYorumlar.includes(yorum.id);
    
    // Yorum için yetkileri hesapla
    const yorumAuth = getAuthActions ? getAuthActions(yorum, currentUser) : { canReport: false, canRemove: false };

    if (isRemoved) {
        return (
            <div className="yorum-karti kaldirilmis-yorum">
                <p className="kaldirilmis-metin">
                    <i className="bi bi-shield-slash-fill me-2"></i>
                    Bu yorum bir moderatör tarafından kaldırılmıştır.
                </p>
                {childYorumlar && childYorumlar.length > 0 && (
                    <div className="child-yorumlar">
                        {childYorumlar.map(childYorum => (
                            <YorumKarti
                                key={childYorum.id}
                                {...{ // Tüm propları kolayca geçmek için spread operatörü
                                    yorum: childYorum,
                                    childYorumlar: childYorum.children || [],
                                    onCevapla, onFormSubmit, onYorumKaldir, onYorumSikayet,
                                    getProfilPath, formatDate, currentUser, replyingTo,
                                    cevapIcerik, setCevapIcerik, kaldirilanYorumlar,
                                    yorumGonderiliyor, getAuthActions
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const yorumSahibi = {
        name: yorum.user_name || 'Bilinmeyen',
        surname: yorum.user_surname || ''
    };
    
    const handleSikayetEt = () => {
        if(onYorumSikayet) onYorumSikayet(yorum.id);
    };

    const handleYorumuKaldir = () => {
        Swal.fire({
            title: 'Emin misiniz?',
            text: "Bu yorumu kalıcı olarak silmek üzeresiniz!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Evet, sil!',
            cancelButtonText: 'İptal'
        }).then((result) => {
            if (result.isConfirmed) {
                if (onYorumKaldir) onYorumKaldir(yorum.id);
            }
        });
    };

    return (
        <div className="yorum-karti-container">
            <div className="yorum-karti">
                <div className="yorum-header">
                    <Link to={getProfilPath(yorum.user_id)} className="yorum-sahibi">
                        {yorumSahibi.name} {yorumSahibi.surname}
                        {yorum.user_rol === 'admin' && <span className="badge bg-danger ms-2">Admin</span>}
                        {yorum.user_rol === 'moderator' && <span className="badge bg-warning ms-2 text-dark">Moderatör</span>}
                    </Link>
                    
                    {(yorumAuth.canReport || yorumAuth.canRemove) && (
                        <div className="dropdown">
                            <button 
                                className="btn btn-sm btn-light py-0 px-2" 
                                type="button" 
                                data-bs-toggle="dropdown" 
                                aria-expanded="false"
                            >
                                <i className="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end">
                                {yorumAuth.canReport && (
                                    <li>
                                        <button className="dropdown-item" onClick={handleSikayetEt}>
                                            <i className="bi bi-flag-fill me-2"></i> Şikayet Et
                                        </button>
                                    </li>
                                )}
                                {yorumAuth.canRemove && (
                                    <li>
                                        <button className="dropdown-item text-danger" onClick={handleYorumuKaldir}>
                                            <i className="bi bi-trash-fill me-2"></i> Yorumu Kaldır
                                        </button>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
                
                <p className="yorum-metni">{yorum.content}</p>

                <div className="yorum-footer">
                    <small className="yorum-tarih">{formatDate(yorum.date)}</small>
                    {currentUser && (
                        <button 
                            onClick={() => onCevapla(yorum.id)} 
                            className="btn btn-link btn-sm p-0 yorum-cevapla-btn"
                        >
                            {replyingTo === yorum.id ? 'İptal' : 'Cevapla'}
                        </button>
                    )}
                </div>
            </div>

            {replyingTo === yorum.id && currentUser && (
                <div className="yorum-cevap-formu">
                    <form onSubmit={(e) => onFormSubmit(e, cevapIcerik, yorum.id.toString(), () => setCevapIcerik(''))}>
                        <textarea
                            value={cevapIcerik}
                            onChange={(e) => setCevapIcerik(e.target.value)}
                            className="form-control"
                            rows="2"
                            placeholder={`${yorumSahibi.name} kullanıcısına cevap yaz...`}
                            disabled={yorumGonderiliyor}
                            autoFocus
                        />
                        <div className="text-end">
                            <button 
                                type="button" 
                                className="btn btn-secondary btn-sm mt-2 me-2"
                                onClick={() => onCevapla(null)}
                            >
                                İptal
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary btn-sm mt-2" 
                                disabled={!cevapIcerik.trim() || yorumGonderiliyor}
                            >
                                {yorumGonderiliyor ? 'Gönderiliyor...' : 'Gönder'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {childYorumlar && childYorumlar.length > 0 && (
                <div className="child-yorumlar">
                    {childYorumlar.map(childYorum => (
                        <YorumKarti
                            key={childYorum.id}
                             {...{
                                yorum: childYorum,
                                childYorumlar: childYorum.children || [],
                                onCevapla, onFormSubmit, onYorumKaldir, onYorumSikayet,
                                getProfilPath, formatDate, currentUser, replyingTo,
                                cevapIcerik, setCevapIcerik, kaldirilanYorumlar,
                                yorumGonderiliyor, getAuthActions
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default YorumKarti;