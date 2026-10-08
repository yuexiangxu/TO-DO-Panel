const pet = document.getElementById('desktop-pet');
const hide = document.getElementById('pet-hide');

hide?.addEventListener('click', (event) => {
  event.stopPropagation();
  window.petAPI?.hide?.();
});

pet?.addEventListener('dblclick', (event) => {
  if (event.target.closest('button')) return;
  window.petAPI?.hide?.();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.petAPI?.hide?.();
});
