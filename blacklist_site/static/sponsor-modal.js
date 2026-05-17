(() => {
  const openButton = document.querySelector("[data-sponsor-open]");
  const modal = document.querySelector("[data-sponsor-modal]");
  if (!openButton || !modal) return;

  const closeButtons = modal.querySelectorAll("[data-sponsor-close]");

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  };

  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add("modal-open");
  };

  openButton.addEventListener("click", openModal);
  closeButtons.forEach((button) => button.addEventListener("click", closeModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
})();
