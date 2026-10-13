import { useEffect, useState } from "react";
import logo from "./img/logo.png";
import heroDog from "./img/heroDog.png";
import heroCat from "./img/heroCat.png";
import landOne from "./img/landOne.png";
import landTwo from "./img/landTwo.png";
import landThree from "./img/landThree.png";
import landFour from "./img/landFour.png";
import directorOne from "./img/directorOne.png";
import directorTwo from "./img/directorTwo.png";
import directorThree from "./img/directorThree.png";
import staffOne from "./img/staffOne.png";
import staffTwo from "./img/staffTwo.png";
import staffThree from "./img/staffThree.png";
import staffFour from "./img/staffFour.png";
import committeeOne from "./img/committeeOne.png";
import committeeTwo from "./img/committeeTwo.png";
import committeeThree from "./img/committeeThree.png";
import committeeFour from "./img/committeeFour.png";
import committeeFive from "./img/committeeFive.png";
import { api, apiUrl } from "./api.js";

const shelterEmail = "pawsitivesa@gmail.com";
const facilityPhotos = [landOne, landTwo, landThree, landFour];
const directorPhotos = [directorOne, directorTwo, directorThree];
const staffPhotos = [staffOne, staffTwo, staffThree, staffFour];
const committeePhotos = [
  committeeOne,
  committeeTwo,
  committeeThree,
  committeeFour,
  committeeFive,
];

function animalWithImage(animal) {
  return {
    ...animal,
    image: animal.imageUrl
      ? apiUrl(animal.imageUrl.replace(/^\/api/, ""))
      : animal.imageKey === "cat"
        ? heroCat
        : heroDog,
  };
}

const maxSourceImageBytes = 2 * 1024 * 1024;
const maxStoredImageBytes = 512 * 1024;

function readImageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function imageDataFromFile(file) {
  if (!file || !file.size) return Promise.resolve(null);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error("Choose a JPEG, PNG, or WebP image."));
  }
  if (file.size > maxSourceImageBytes) {
    return Promise.reject(new Error("Choose an image smaller than 2 MB."));
  }
  if (file.size <= maxStoredImageBytes) return readImageData(file);
  return createImageBitmap(file).then(async (bitmap) => {
    try {
      let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      for (let attempt = 0; attempt < 10; attempt += 1) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the selected image.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) =>
          canvas.toBlob(
            resolve,
            "image/jpeg",
            Math.max(0.55, 0.86 - attempt * 0.04),
          ),
        );
        if (blob && blob.size <= maxStoredImageBytes) {
          return readImageData(blob);
        }
        scale *= 0.8;
      }
      throw new Error("Could not reduce the image enough to upload it.");
    } finally {
      bitmap.close();
    }
  });
}

function ProfileAvatar({ user, className = "" }) {
  return (
    <span className={`avatar avatar-initials ${className}`}>
      {user.profileImageUrl ? (
        <img src={apiUrl(user.profileImageUrl.replace(/^\/api/, ""))} alt="" />
      ) : (
        user.name[0].toUpperCase()
      )}
    </span>
  );
}

function formatRand(amount) {
  return `R${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getPage() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function App() {
  const [page, setPage] = useState(getPage);
  const [animals, setAnimals] = useState([]);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [notice, setNotice] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventKind, setEventKind] = useState("event");
  const [events, setEvents] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [teamNotices, setTeamNotices] = useState([]);
  const [donationStats, setDonationStats] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => setPage(getPage());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSessionAndAnimals() {
      try {
        const session = await api("/auth/me");
        if (active) setUser(session.user ?? null);
      } catch (error) {
        if (active) setLoadError(error.message);
      }
      try {
        const rows = await api("/animals");
        if (active) setAnimals(rows.map(animalWithImage));
      } catch (error) {
        if (active) setLoadError(`Could not load animals: ${error.message}`);
      } finally {
        if (active) setReady(true);
      }
    }
    loadSessionAndAnimals();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || user?.role !== "staff") return undefined;
    let active = true;
    Promise.all([
      api("/events"),
      api("/notices"),
      api("/donations?page=1"),
      api("/availability"),
      api("/site-visits"),
    ])
      .then(
        ([
          loadedEvents,
          loadedNotices,
          loadedDonations,
          loadedAvailability,
          loadedSiteVisits,
        ]) => {
          if (!active) return;
          setEvents(loadedEvents);
          setTeamNotices(loadedNotices);
          setDonationStats(loadedDonations.stats);
          setAvailability(loadedAvailability);
          setSiteVisits(loadedSiteVisits);
        },
      )
      .catch((error) => {
        if (active) setNotice(`Could not load staff data: ${error.message}`);
      });
    return () => {
      active = false;
    };
  }, [ready, user]);

  useEffect(() => {
    if (user && (page === "/signin" || page === "/signup")) {
      navigate(user.role === "staff" ? "/staff/dashboard" : "/user");
    }
  }, [page, user]);

  function navigate(path) {
    window.history.pushState({}, "", path);
    setPage(path);
    setModal("");
    setNotice("");
    window.scrollTo(0, 0);
  }

  async function authenticate(credentials, signup) {
    const session = await api(`/auth/${signup ? "signup" : "login"}`, {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setUser(session.user);
    const rows = await api("/animals");
    setAnimals(rows.map(animalWithImage));
    navigate(session.user.role === "staff" ? "/staff/dashboard" : "/user");
  }

  async function reloadAnimals() {
    setLoadError("");
    try {
      const rows = await api("/animals");
      setAnimals(rows.map(animalWithImage));
    } catch (error) {
      setLoadError(`Could not load animals: ${error.message}`);
    }
  }

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/");
    } catch (error) {
      setNotice(`Could not sign out: ${error.message}`);
    }
  }

  if (!ready) {
    return (
      <main className="app-loading" aria-live="polite">
        Connecting to Pawsitive…
      </main>
    );
  }

  if (page === "/signin" || page === "/signup") {
    if (user) {
      return (
        <main className="app-loading" aria-live="polite">
          Redirecting…
        </main>
      );
    }
    return (
      <AuthPage
        mode={page === "/signup" ? "signup" : "signin"}
        onNavigate={navigate}
        onSubmit={(credentials) =>
          authenticate(credentials, page === "/signup")
        }
      />
    );
  }

  if (page.startsWith("/staff") && user?.role !== "staff") {
    return (
      <AuthPage
        mode="signin"
        onNavigate={navigate}
        onSubmit={(credentials) => authenticate(credentials, false)}
      />
    );
  }

  if (page === "/staff/profile" && user?.role === "staff") {
    return (
      <UserProfilePortal
        user={user}
        navigate={navigate}
        onSignOut={signOut}
        onSave={async (changes) => {
          const result = await api("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify(changes),
          });
          setUser(result.user);
        }}
      />
    );
  }

  const userPortalPage = page.startsWith("/user");
  const userSection =
    {
      "/": "home",
      "/user": "home",
      "/user/home": "home",
      "/user/adopt": "adopt",
      "/adopt": "adopt",
      "/user/donate": "donate",
      "/user/calendar": "calendar",
    }[page] ?? "";

  if (userPortalPage && user?.role !== "user") {
    return (
      <AuthPage
        mode="signin"
        onNavigate={navigate}
        onSubmit={(credentials) => authenticate(credentials, false)}
      />
    );
  }

  if (page === "/user/profile" && user) {
    return (
      <UserProfilePortal
        user={user}
        navigate={navigate}
        onSignOut={signOut}
        onSave={async (changes) => {
          const result = await api("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify(changes),
          });
          setUser(result.user);
        }}
        onDelete={async (password) => {
          await api("/auth/me", {
            method: "DELETE",
            body: JSON.stringify({ password }),
          });
          setUser(null);
          navigate("/");
        }}
      />
    );
  }

  if (user && user.role === "user" && (userSection || page === "/donate")) {
    const section = page === "/donate" ? "donate" : userSection;
    return (
      <UserPortal
        section={section}
        user={user}
        animals={animals}
        navigate={navigate}
        onSignOut={signOut}
        onSelect={(animal) => {
          setSelectedAnimal(animal);
          setModal("user-animal-profile");
        }}
      >
        {section === "home" && (
          <UserHomePage user={user} animals={animals} navigate={navigate} />
        )}
        {section === "adopt" && (
          <AnimalsPage
            animals={animals}
            canManage={false}
            onSelect={(animal) => {
              setSelectedAnimal(animal);
              setModal("user-animal-profile");
            }}
          />
        )}
        {section === "donate" && (
          <DonationCheckoutPage onNavigate={navigate} user={user} embedded />
        )}
        {section === "calendar" && <SiteVisitCalendar />}
        {modal === "user-animal-profile" && selectedAnimal && (
          <Modal onClose={() => setModal("")}>
            <AnimalProfile
              animal={selectedAnimal}
              onClose={() => setModal("")}
            />
          </Modal>
        )}
      </UserPortal>
    );
  }

  if (!page.startsWith("/staff")) {
    if (page === "/donate") {
      return <DonationCheckoutPage onNavigate={navigate} />;
    }
    if (page === "/donation/complete") {
      if (user?.role === "user") {
        return (
          <UserPortal
            section="donate"
            user={user}
            navigate={navigate}
            onSignOut={signOut}
          >
            <DonationCompletePage onNavigate={navigate} embedded />
          </UserPortal>
        );
      }
      return <DonationCompletePage onNavigate={navigate} />;
    }
    return (
      <>
        <PublicPage
          animals={animals}
          userView={page === "/adopt"}
          currentUser={user}
          onNavigate={navigate}
          onSignOut={signOut}
          loadError={loadError}
          onRetry={reloadAnimals}
          onSelect={(animal) => {
            setSelectedAnimal(animal);
            setModal("public-animal-profile");
          }}
        />
        {modal === "public-animal-profile" && selectedAnimal && (
          <Modal onClose={() => setModal("")}>
            <AnimalProfile
              animal={selectedAnimal}
              onClose={() => setModal("")}
            />
          </Modal>
        )}
      </>
    );
  }

  const staffPage =
    page.replace("/staff", "").replace(/^\/+/, "") || "dashboard";
  const currentPage = ["animals", "donations", "calendar"].includes(staffPage)
    ? staffPage
    : "dashboard";

  async function addAnimal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      setNotice("Animal name is required.");
      return;
    }
    try {
      const imageData = await imageDataFromFile(form.get("image"));
      const created = await api("/animals", {
        method: "POST",
        body: JSON.stringify({
          name,
          type: form.get("type"),
          breed: form.get("breed"),
          age: form.get("age"),
          description: form.get("description"),
          ...(imageData ? { imageData } : {}),
        }),
      });
      const newAnimal = animalWithImage(created);
      setAnimals((items) => [newAnimal, ...items]);
      setModal("");
      setNotice(`${name} has been added to the animals list.`);
    } catch (error) {
      setNotice(`Could not add animal: ${error.message}`);
    }
  }

  async function deleteAnimal() {
    if (!selectedAnimal) return;
    try {
      await api(`/animals/${selectedAnimal.id}`, { method: "DELETE" });
      setAnimals((items) =>
        items.filter((animal) => animal.id !== selectedAnimal.id),
      );
      setNotice(`${selectedAnimal.name} has been removed from the system.`);
      setSelectedAnimal(null);
      setModal("");
    } catch (error) {
      setNotice(`Could not delete animal: ${error.message}`);
    }
  }

  async function updateAnimal(animal, changes) {
    try {
      const updated = animalWithImage(
        await api(`/animals/${animal.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...animal, ...changes }),
        }),
      );
      setAnimals((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedAnimal(updated);
      return updated;
    } catch (error) {
      setNotice(`Could not update animal: ${error.message}`);
      return null;
    }
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!eventName.trim() || !eventDate) {
      setNotice("Event name and date are required.");
      return;
    }
    try {
      const created = await api("/events", {
        method: "POST",
        body: JSON.stringify({
          title: eventName.trim(),
          date: eventDate,
          time: eventTime || null,
          notes: eventNotes,
          kind: eventKind,
        }),
      });
      setEvents((items) =>
        [...items, created].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setModal("");
      setEventName("");
      setEventDate("");
      setEventTime("");
      setEventNotes("");
      setEventKind("event");
      setNotice("Your event has been added to the calendar.");
    } catch (error) {
      setNotice(`Could not add event: ${error.message}`);
    }
  }

  async function deleteEvent(eventId) {
    try {
      await api(`/events/${eventId}`, { method: "DELETE" });
      setEvents((items) => items.filter((item) => item.id !== eventId));
      setNotice("The event has been removed from the calendar.");
    } catch (error) {
      setNotice(`Could not delete event: ${error.message}`);
    }
  }

  async function publishNotice(message) {
    try {
      const created = await api("/notices", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setTeamNotices((items) => [created, ...items]);
      setNotice("Your notice has been shared with the team.");
      return true;
    } catch (error) {
      setNotice(`Could not publish notice: ${error.message}`);
      return false;
    }
  }

  async function saveAnimalChanges(event) {
    event.preventDefault();
    if (!selectedAnimal) return;
    const form = new FormData(event.currentTarget);
    try {
      const imageFile = form.get("image");
      const removeImage = form.get("removeImage") === "on";
      const imageData = removeImage ? null : await imageDataFromFile(imageFile);
      const updated = await updateAnimal(selectedAnimal, {
        name: String(form.get("name") || "").trim(),
        type: String(form.get("type") || ""),
        breed: String(form.get("breed") || "").trim(),
        age: String(form.get("age") || "").trim(),
        description: String(form.get("description") || "").trim(),
        status: String(form.get("status") || ""),
        ...(removeImage ? { imageData: null } : imageData ? { imageData } : {}),
      });
      if (updated) {
        setModal("");
        setNotice(`${updated.name}'s profile has been updated.`);
      }
    } catch (error) {
      setNotice(`Could not update animal: ${error.message}`);
    }
  }

  async function saveAvailability(date, time) {
    try {
      const saved = await api(`/availability/${date}`, {
        method: "PUT",
        body: JSON.stringify({ time }),
      });
      setAvailability((items) =>
        [...items.filter((item) => item.date !== date), saved].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setModal("");
      setNotice(`Availability saved for ${date} at ${time}.`);
    } catch (error) {
      setNotice(`Could not save availability: ${error.message}`);
    }
  }

  return (
    <div className="staff-app">
      <StaffSidebar
        page={currentPage}
        user={user}
        animalCount={animals.length}
        navigate={navigate}
        onSignOut={signOut}
      />
      <main className="staff-main">
        <header className="staff-topbar">
          <div className="staff-welcome">
            <span className="staff-kicker">PAWSITIVE ANIMAL SHELTER</span>
            <h1>
              {currentPage === "dashboard"
                ? `Welcome back, ${user.name.split(" ")[0]}`
                : pageTitle(currentPage)}
            </h1>
            <p>
              {new Date().toLocaleDateString("en-ZA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              <span className="topbar-dot">•</span> Laezonia AH
            </p>
          </div>
          <div className="staff-top-actions">
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() =>
                setNotice(teamNotices[0]?.message || "No team notices yet.")
              }
            >
              ♧{teamNotices.length > 0 && <i />}
            </button>
            <button
              className="profile-chip"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <ProfileAvatar user={user} />
              <span>
                {user.name}
                <small>{user.role === "staff" ? "Staff" : "User"}</small>
              </span>
              <b>⌄</b>
            </button>
            {profileMenuOpen && (
              <div className="profile-menu">
                <span>{user.email}</span>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigate("/staff/profile");
                  }}
                >
                  My profile
                </button>
                <button onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </header>

        {notice && (
          <div className="staff-notice" role="status">
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {currentPage === "dashboard" && (
          <Dashboard
            events={events}
            navigate={navigate}
            setModal={setModal}
            animals={animals}
            donationStats={donationStats}
            notices={teamNotices}
            onPublishNotice={publishNotice}
          />
        )}
        {currentPage === "animals" && (
          <AnimalsPage
            animals={animals}
            canManage={user.role === "staff"}
            onAdd={() => setModal("add-animal")}
            onSelect={(animal) => {
              setSelectedAnimal(animal);
              setModal("animal-profile");
            }}
            onDelete={
              user.role === "staff"
                ? (animal) => {
                    setSelectedAnimal(animal);
                    setModal("delete-animal");
                  }
                : undefined
            }
          />
        )}
        {currentPage === "donations" && <DonationsPage onError={setNotice} />}
        {currentPage === "calendar" && (
          <CalendarPage
            events={events}
            availability={availability}
            siteVisits={siteVisits}
            onAdd={() => setModal("add-event")}
            onAvailability={() => setModal("availability")}
            onDeleteEvent={deleteEvent}
          />
        )}
      </main>

      {modal && user.role === "staff" && (
        <Modal onClose={() => setModal("")}>
          {modal === "add-animal" && (
            <div className="modal-content">
              <ModalHeading
                title="Add an animal"
                subtitle="Add a new friend to the shelter."
                onClose={() => setModal("")}
              />
              <form className="staff-form" onSubmit={addAnimal}>
                <label className="image-upload-field">
                  Pet photo
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                  <small>
                    JPEG, PNG, or WebP · max 2 MB, optimized before upload
                  </small>
                </label>
                <label>
                  Animal name
                  <input
                    name="name"
                    placeholder="e.g. Baxter"
                    required
                    autoFocus
                  />
                </label>
                <div className="form-columns">
                  <label>
                    Animal type
                    <select name="type">
                      <option>Dog</option>
                      <option>Cat</option>
                    </select>
                  </label>
                  <label>
                    Age
                    <input name="age" placeholder="e.g. 2 years" />
                  </label>
                </div>
                <label>
                  Breed
                  <input name="breed" placeholder="e.g. Beagle mix" />
                </label>
                <label>
                  Short description
                  <textarea
                    name="description"
                    placeholder="Tell us a little about this animal..."
                    rows="3"
                  />
                </label>
                <button
                  className="staff-button primary-button form-submit"
                  type="submit"
                >
                  Add animal
                </button>
              </form>
            </div>
          )}
          {modal === "delete-animal" && (
            <div className="modal-content confirm-content">
              <span className="confirm-icon">!</span>
              <h2>
                Are you sure you want to delete
                <br />
                this animal from the system?
              </h2>
              <p>
                This will permanently remove {selectedAnimal?.name} from the
                animals list.
              </p>
              <div className="modal-actions">
                <button
                  className="staff-button neutral-button"
                  onClick={() => setModal("")}
                >
                  Cancel
                </button>
                <button
                  className="staff-button danger-button"
                  onClick={deleteAnimal}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
          {modal === "edit-animal" && selectedAnimal && (
            <div className="modal-content">
              <ModalHeading
                title={`Edit ${selectedAnimal.name}`}
                subtitle="Update the animal's shelter profile."
                onClose={() => setModal("")}
              />
              <form className="staff-form" onSubmit={saveAnimalChanges}>
                {selectedAnimal.imageUrl && (
                  <img
                    className="animal-edit-preview"
                    src={selectedAnimal.image}
                    alt={`${selectedAnimal.name}`}
                  />
                )}
                <label className="image-upload-field">
                  {selectedAnimal.imageUrl ? "Replace pet photo" : "Pet photo"}
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                  <small>
                    JPEG, PNG, or WebP · max 2 MB, optimized before upload
                  </small>
                </label>
                {selectedAnimal.imageUrl && (
                  <label className="image-remove-control">
                    <input name="removeImage" type="checkbox" />
                    Remove current photo
                  </label>
                )}
                <label>
                  Animal name
                  <input
                    name="name"
                    defaultValue={selectedAnimal.name}
                    required
                    maxLength={120}
                  />
                </label>
                <div className="form-columns">
                  <label>
                    Animal type
                    <select name="type" defaultValue={selectedAnimal.type}>
                      <option>Dog</option>
                      <option>Cat</option>
                    </select>
                  </label>
                  <label>
                    Age
                    <input
                      name="age"
                      defaultValue={selectedAnimal.age}
                      maxLength={80}
                    />
                  </label>
                </div>
                <label>
                  Breed
                  <input
                    name="breed"
                    defaultValue={selectedAnimal.breed}
                    maxLength={160}
                  />
                </label>
                <label>
                  Short description
                  <textarea
                    name="description"
                    defaultValue={selectedAnimal.description}
                    rows="3"
                    maxLength={5000}
                  />
                </label>
                <label>
                  Adoption status
                  <select name="status" defaultValue={selectedAnimal.status}>
                    <option>Available</option>
                    <option>Adopted</option>
                  </select>
                </label>
                <button
                  className="staff-button primary-button form-submit"
                  type="submit"
                >
                  Save changes
                </button>
              </form>
            </div>
          )}
          {modal === "animal-profile" && selectedAnimal && (
            <AnimalProfile
              animal={selectedAnimal}
              canManage={user.role === "staff"}
              onClose={() => setModal("")}
              onEdit={() => setModal("edit-animal")}
              onMarkAdopted={async () => {
                const updated = await updateAnimal(selectedAnimal, {
                  status:
                    selectedAnimal.status === "Available"
                      ? "Adopted"
                      : "Available",
                });
                if (updated) {
                  setNotice(
                    `${selectedAnimal.name} is now ${updated.status.toLowerCase()}.`,
                  );
                  setModal("");
                }
              }}
            />
          )}
          {modal === "add-event" && (
            <div className="modal-content">
              <ModalHeading
                title="New event"
                subtitle="Add an event to the shelter calendar."
                onClose={() => setModal("")}
              />
              <form className="staff-form" onSubmit={saveEvent}>
                <label>
                  Event name
                  <input
                    value={eventName}
                    onChange={(event) => setEventName(event.target.value)}
                    placeholder="e.g. Volunteer orientation"
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(event) => setEventTime(event.target.value)}
                  />
                </label>
                <label>
                  Event type
                  <select
                    value={eventKind}
                    onChange={(event) => setEventKind(event.target.value)}
                  >
                    <option value="event">General event</option>
                    <option value="medical">Medical</option>
                    <option value="supply">Delivery / supplies</option>
                  </select>
                </label>
                <label>
                  Notes
                  <textarea
                    value={eventNotes}
                    onChange={(event) => setEventNotes(event.target.value)}
                    placeholder="Add any helpful details..."
                    rows="3"
                  />
                </label>
                <button
                  className="staff-button primary-button form-submit"
                  type="submit"
                >
                  Add event
                </button>
              </form>
            </div>
          )}
          {modal === "availability" && (
            <AvailabilityModal
              availability={availability}
              onClose={() => setModal("")}
              onSave={saveAvailability}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function StaffSidebar({ page, user, animalCount, navigate, onSignOut }) {
  const items = [
    ["dashboard", "⌂", "Home"],
    ["animals", "♡", "Animals"],
    ["donations", "▤", "Donations"],
    ["calendar", "▦", "Calendar"],
    ["profile", "◉", "My profile"],
  ];
  return (
    <aside className="staff-sidebar">
      <a
        href="/"
        className="staff-brand"
        onClick={(event) => {
          event.preventDefault();
          navigate("/");
        }}
      >
        <img src={logo} alt="Pawsitive" />
        <span>STAFF PORTAL</span>
      </a>
      <div className="sidebar-user">
        <ProfileAvatar user={user} />
        <div>
          <strong>{user.name}</strong>
          <small>Shelter staff</small>
        </div>
        <span className="online-dot" />
      </div>
      <nav className="staff-nav" aria-label="Staff navigation">
        {items.map(([key, icon, label]) => (
          <a
            key={key}
            href={`/staff/${key}`}
            className={page === key ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              navigate(`/staff/${key}`);
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            {label}
            {key === "animals" && (
              <span className="nav-count">{animalCount}</span>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <span>Need a hand?</span>
          <small>Contact the admin team</small>
          <a href={`mailto:${shelterEmail}`}>
            Get help <span>→</span>
          </a>
        </div>
        <button onClick={onSignOut} className="sign-out">
          <span>↪</span> Sign out
        </button>
        <span className="sidebar-version">PAWSITIVE · STAFF PORTAL</span>
      </div>
    </aside>
  );
}

function UserPortal({ section, user, navigate, onSignOut, children }) {
  const titles = {
    home: ["Welcome home", "A place to follow your journey with Pawsitive."],
    adopt: [
      "Find your new best friend",
      "Meet the animals waiting for a loving home.",
    ],
    donate: [
      "Support the animals",
      "Every contribution helps provide care and comfort.",
    ],
    calendar: [
      "Book a site visit",
      "Choose an available day to visit the shelter.",
    ],
  };
  const [title, subtitle] = titles[section] || titles.home;
  return (
    <div className="staff-app">
      <UserPortalSidebar
        page={section}
        user={user}
        navigate={navigate}
        onSignOut={onSignOut}
      />
      <main className="staff-main user-profile-main">
        <header className="staff-topbar">
          <div className="staff-welcome">
            <span className="staff-kicker">PAWSITIVE ANIMAL SHELTER</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="profile-chip user-profile-chip">
            <ProfileAvatar user={user} />
            <span>{user.name}</span>
          </span>
          <button className="user-mobile-signout" onClick={onSignOut}>
            Sign out
          </button>
        </header>
        <section className={`user-portal-content user-page-${section}`}>
          {children}
        </section>
      </main>
    </div>
  );
}

function UserHomePage({ user, animals, navigate }) {
  const [visits, setVisits] = useState([]);
  const [visitError, setVisitError] = useState("");
  useEffect(() => {
    let active = true;
    api("/site-visits/mine")
      .then((rows) => {
        if (active) setVisits(rows);
      })
      .catch((error) => {
        if (active)
          setVisitError(`Could not load your site visits: ${error.message}`);
      });
    return () => {
      active = false;
    };
  }, []);
  const availableAnimals = animals.filter(
    (animal) => animal.status === "Available",
  );
  return (
    <div className="user-home-grid">
      <section className="user-welcome-card">
        <span className="staff-kicker">YOUR PAWSITIVE JOURNEY</span>
        <h2>Hello, {user.name.split(" ")[0]}!</h2>
        <p>
          Find a companion, plan a visit, or lend a paw to animals in our care.
        </p>
        <div className="user-home-actions">
          <button
            className="staff-button primary-button"
            onClick={() => navigate("/user/adopt")}
          >
            Meet the animals <span aria-hidden="true">→</span>
          </button>
          <button
            className="staff-button outline-button"
            onClick={() => navigate("/user/calendar")}
          >
            Book a visit
          </button>
        </div>
      </section>
      <section className="panel user-next-visit">
        <PanelHeading eyebrow="YOUR CALENDAR" title="Upcoming site visit" />
        {visitError && (
          <p className="user-calendar-message" role="alert">
            {visitError}
          </p>
        )}
        {visits.length ? (
          <div className="user-visit-preview">
            <span className="user-visit-date">{visits[0].date}</span>
            <strong>{visits[0].time}</strong>
            <button
              className="text-action"
              onClick={() => navigate("/user/calendar")}
            >
              View booking →
            </button>
          </div>
        ) : (
          <div className="user-empty-visit">
            <p>No site visits booked yet.</p>
            <button
              className="text-action"
              onClick={() => navigate("/user/calendar")}
            >
              Choose a visit date →
            </button>
          </div>
        )}
      </section>
      <section className="panel user-featured-animals">
        <PanelHeading
          eyebrow="READY TO MEET YOU"
          title="Pets looking for a home"
          action="See all animals"
          onAction={() => navigate("/user/adopt")}
        />
        <div className="user-featured-grid">
          {availableAnimals.slice(0, 3).map((animal) => (
            <article className="user-featured-card" key={animal.id}>
              <img src={animal.image} alt={animal.name} />
              <div>
                <strong>{animal.name}</strong>
                <span>
                  {animal.type} · {animal.breed || "Waiting for a family"}
                </span>
              </div>
            </article>
          ))}
          {!availableAnimals.length && (
            <p>No animal profiles are available right now.</p>
          )}
        </div>
      </section>
      <button
        className="user-support-card"
        onClick={() => navigate("/user/donate")}
      >
        <span aria-hidden="true">♡</span>
        <span>
          <strong>Make a difference</strong>
          <small>
            Your support helps give every animal the care they deserve.
          </small>
        </span>
        <b aria-hidden="true">→</b>
      </button>
    </div>
  );
}

function SiteVisitCalendar() {
  const [available, setAvailable] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function reloadVisits() {
    const [slots, bookings] = await Promise.all([
      api("/site-visits/availability"),
      api("/site-visits/mine"),
    ]);
    setAvailable(slots);
    setVisits(bookings);
  }

  useEffect(() => {
    let active = true;
    Promise.all([api("/site-visits/availability"), api("/site-visits/mine")])
      .then(([slots, bookings]) => {
        if (!active) return;
        setAvailable(slots);
        setVisits(bookings);
      })
      .catch((error) => {
        if (active) setMessage(`Could not load visit dates: ${error.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const slotsByDate = new Map(available.map((slot) => [slot.date, slot]));
  const visitsByDate = new Map(visits.map((visit) => [visit.date, visit]));
  const selectedSlot = slotsByDate.get(selectedDate);

  async function bookVisit() {
    setMessage("");
    try {
      const booked = await api("/site-visits", {
        method: "POST",
        body: JSON.stringify({ date: selectedDate }),
      });
      setVisits((items) =>
        [...items, booked].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setAvailable((items) =>
        items.filter((slot) => slot.date !== booked.date),
      );
      setSelectedDate("");
      setMessage("Your site visit has been booked.");
    } catch (error) {
      setMessage(`Could not book this visit: ${error.message}`);
      if (error.message.toLowerCase().includes("no longer available")) {
        reloadVisits().catch((reloadError) =>
          setMessage(`Could not refresh visit dates: ${reloadError.message}`),
        );
      }
    }
  }

  async function cancelVisit(visit) {
    setMessage("");
    try {
      await api(`/site-visits/${visit.id}`, { method: "DELETE" });
      setVisits((items) => items.filter((item) => item.id !== visit.id));
      setAvailable((items) =>
        [
          ...items.filter((slot) => slot.date !== visit.date),
          { date: visit.date, time: visit.time },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setMessage("Your visit booking has been cancelled.");
    } catch (error) {
      setMessage(`Could not cancel this visit: ${error.message}`);
    }
  }

  return (
    <div className="user-calendar-layout">
      <section className="panel user-calendar-panel">
        <div className="user-calendar-heading">
          <div>
            <span className="panel-eyebrow">VISIT THE SHELTER</span>
            <h2>
              {month.toLocaleDateString("en-ZA", {
                month: "long",
                year: "numeric",
              })}
            </h2>
          </div>
          <div className="user-month-controls">
            <button
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ‹
            </button>
            <button
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              ›
            </button>
          </div>
        </div>
        <div className="user-calendar-grid user-calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="user-calendar-grid">
          {Array.from({ length: firstDay }, (_, index) => (
            <span className="user-calendar-empty" key={`empty-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const date = new Date(
              month.getFullYear(),
              month.getMonth(),
              index + 1,
            );
            const key = dateKey(date);
            const slot = slotsByDate.get(key);
            const visit = visitsByDate.get(key);
            return (
              <button
                key={key}
                className={`user-calendar-day ${slot ? "available" : ""} ${visit ? "booked" : ""} ${selectedDate === key ? "selected" : ""}`}
                disabled={!slot && !visit}
                aria-label={`${key}${slot ? `, available at ${slot.time}` : ""}${visit ? `, your visit at ${visit.time}` : ""}`}
                onClick={() => setSelectedDate(key)}
              >
                <span>{index + 1}</span>
                {(slot || visit) && <i />}
              </button>
            );
          })}
        </div>
        <div className="user-calendar-legend">
          <span>
            <i className="available-dot" /> Available
          </span>
          <span>
            <i className="booked-dot" /> Your visit
          </span>
        </div>
      </section>
      <aside className="panel user-booking-panel">
        <PanelHeading eyebrow="YOUR VISITS" title="Upcoming bookings" />
        {loading ? (
          <p className="user-calendar-message">Loading visit dates…</p>
        ) : visits.length ? (
          <div className="user-visit-list">
            {visits.map((visit) => (
              <article key={visit.id} className="user-visit-row">
                <span className="user-visit-date">{visit.date}</span>
                <strong>{visit.time}</strong>
                <button
                  className="text-action"
                  onClick={() => cancelVisit(visit)}
                >
                  Cancel
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="user-calendar-message">
            {available.length
              ? "No visits booked. Available days are marked on the calendar."
              : "No visit dates are open yet. Please check back after the shelter team publishes availability."}
          </p>
        )}
        {selectedSlot && (
          <div className="user-selected-slot">
            <span className="panel-eyebrow">AVAILABLE VISIT</span>
            <strong>{selectedSlot.date}</strong>
            <span>Visit time: {selectedSlot.time}</span>
            <button className="staff-button primary-button" onClick={bookVisit}>
              Book this visit
            </button>
          </div>
        )}
        {selectedDate && visitsByDate.has(selectedDate) && (
          <div className="user-selected-slot">
            <span className="panel-eyebrow">YOUR VISIT</span>
            <strong>{selectedDate}</strong>
            <span>Visit time: {visitsByDate.get(selectedDate).time}</span>
          </div>
        )}
        {message && (
          <p className="user-profile-message" role="status">
            {message}
          </p>
        )}
      </aside>
    </div>
  );
}

function ProfilePicturePicker({ user }) {
  const [preview, setPreview] = useState(
    user.profileImageUrl
      ? apiUrl(user.profileImageUrl.replace(/^\/api/, ""))
      : "",
  );
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="profile-picture-picker">
      <div className="profile-picture-preview">
        {preview ? (
          <img src={preview} alt={`${user.name} profile`} />
        ) : (
          <span>{user.name[0].toUpperCase()}</span>
        )}
      </div>
      <div className="profile-picture-controls">
        <label className="image-upload-field">
          Profile picture
          <input
            name="profileImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const nextUrl = URL.createObjectURL(file);
              setPreviewUrl(nextUrl);
              setPreview(nextUrl);
              const removeControl =
                event.currentTarget.form?.elements.removeProfileImage;
              if (removeControl) removeControl.checked = false;
            }}
          />
          <small>JPEG, PNG, or WebP · max 2 MB, optimized before upload</small>
        </label>
        {user.profileImageUrl && (
          <label className="image-remove-control">
            <input
              name="removeProfileImage"
              type="checkbox"
              onChange={(event) => {
                if (event.target.checked) {
                  setPreview("");
                  const imageInput =
                    event.currentTarget.form?.elements.profileImage;
                  if (imageInput) imageInput.value = "";
                } else {
                  setPreview(
                    apiUrl(user.profileImageUrl.replace(/^\/api/, "")),
                  );
                }
              }}
            />
            Remove profile picture
          </label>
        )}
      </div>
    </div>
  );
}

function UserProfilePortal({ user, navigate, onSignOut, onSave, onDelete }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (newPassword && newPassword !== confirmPassword) {
      setMessage("Your new passwords do not match.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const imageFile = form.get("profileImage");
      const removeProfileImage = form.get("removeProfileImage") === "on";
      const profileImageData = removeProfileImage
        ? null
        : imageFile?.size
          ? await imageDataFromFile(imageFile)
          : undefined;
      await onSave({
        name: String(form.get("name") || "").trim(),
        email: String(form.get("email") || "").trim(),
        currentPassword: String(form.get("currentPassword") || ""),
        newPassword,
        ...(profileImageData !== undefined ? { profileImageData } : {}),
      });
      formElement.elements.currentPassword.value = "";
      formElement.elements.newPassword.value = "";
      formElement.elements.confirmPassword.value = "";
      formElement.elements.profileImage.value = "";
      setMessage("Your profile has been updated.");
    } catch (error) {
      setMessage(`Could not update your profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("confirmation") !== "DELETE") {
      setMessage("Type DELETE to confirm account removal.");
      return;
    }
    setDeleting(true);
    setMessage("");
    try {
      await onDelete(String(form.get("deletePassword") || ""));
    } catch (error) {
      setMessage(`Could not delete your account: ${error.message}`);
      setDeleting(false);
    }
  }

  return (
    <div className="staff-app">
      <UserPortalSidebar
        page="profile"
        user={user}
        navigate={navigate}
        onSignOut={onSignOut}
      />
      <main className="staff-main user-profile-main">
        <header className="staff-topbar">
          <div className="staff-welcome">
            <span className="staff-kicker">PAWSITIVE ANIMAL SHELTER</span>
            <h1>My profile</h1>
            <p>Manage your account details and sign-in settings.</p>
          </div>
          <span className="profile-chip user-profile-chip">
            <ProfileAvatar user={user} />
            <span>{user.name}</span>
          </span>
          <button className="user-mobile-signout" onClick={onSignOut}>
            Sign out
          </button>
        </header>
        <section className="user-profile-content">
          <div className="user-profile-intro">
            <span className="staff-kicker">ACCOUNT SETTINGS</span>
            <h2>Your details</h2>
            <p>Keep your contact information up to date.</p>
          </div>
          <form className="user-profile-form" onSubmit={saveProfile}>
            <ProfilePicturePicker user={user} />
            <label>
              Full name
              <input
                name="name"
                defaultValue={user.name}
                required
                maxLength={120}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                defaultValue={user.email}
                required
                maxLength={254}
              />
            </label>
            <div className="user-profile-divider" />
            <div className="user-profile-intro user-password-intro">
              <h3>
                Change password <span>(optional)</span>
              </h3>
              <p>
                Leave both new password fields blank to keep your current
                password.
              </p>
            </div>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={200}
                placeholder="At least 10 characters"
              />
            </label>
            <label>
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={200}
              />
            </label>
            <label className="profile-current-password">
              Current password <span>Required to save changes</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="staff-button primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
          {user.role === "user" && (
            <section className="user-delete-card">
              <div>
                <span className="staff-kicker">DANGER ZONE</span>
                <h2>Delete account</h2>
                <p>
                  This permanently removes your account and signs you out. This
                  action cannot be undone.
                </p>
              </div>
              <form onSubmit={deleteAccount}>
                <label>
                  Account password
                  <input
                    name="deletePassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  Type <strong>DELETE</strong> to confirm
                  <input name="confirmation" required />
                </label>
                <button className="user-delete-button" disabled={deleting}>
                  {deleting
                    ? "Deleting account…"
                    : "Permanently delete account"}
                </button>
              </form>
            </section>
          )}
          {message && (
            <p className="user-profile-message" role="status">
              {message}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function UserPortalSidebar({ page, user, navigate, onSignOut }) {
  const isStaff = user.role === "staff";
  const items = isStaff
    ? [
        ["dashboard", "⌂", "Home", "/staff/dashboard"],
        ["animals", "♡", "Animals", "/staff/animals"],
        ["donations", "▤", "Donations", "/staff/donations"],
        ["calendar", "▦", "Calendar", "/staff/calendar"],
        ["profile", "◉", "My profile", "/staff/profile"],
      ]
    : [
        ["home", "⌂", "Home", "/user/home"],
        ["adopt", "♡", "Adopt", "/user/adopt"],
        ["donate", "▤", "Donate", "/user/donate"],
        ["calendar", "▦", "Calendar", "/user/calendar"],
        ["profile", "◉", "My profile", "/user/profile"],
      ];
  return (
    <aside className="staff-sidebar">
      <a
        href={isStaff ? "/staff/dashboard" : "/user/home"}
        className="staff-brand"
        onClick={(event) => {
          event.preventDefault();
          navigate(isStaff ? "/staff/dashboard" : "/user/home");
        }}
      >
        <img src={logo} alt="Pawsitive" />
        <span>{isStaff ? "STAFF PORTAL" : "USER PORTAL"}</span>
      </a>
      <div className="sidebar-user">
        <ProfileAvatar user={user} />
        <div>
          <strong>{user.name}</strong>
          <small>{isStaff ? "Shelter staff" : "Shelter supporter"}</small>
        </div>
        <span className="online-dot" />
      </div>
      <nav
        className="staff-nav"
        aria-label={isStaff ? "Staff navigation" : "User navigation"}
      >
        {items.map(([key, icon, label, href]) => (
          <a
            key={key}
            href={href}
            className={page === key ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              navigate(href);
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <span>Need a hand?</span>
          <small>Contact the shelter team</small>
          <a href={`mailto:${shelterEmail}`}>
            Get help <span>→</span>
          </a>
        </div>
        <button onClick={onSignOut} className="sign-out">
          <span>↪</span> Sign out
        </button>
        <span className="sidebar-version">
          PAWSITIVE · {isStaff ? "STAFF" : "USER"} PORTAL
        </span>
      </div>
    </aside>
  );
}

function Dashboard({
  events,
  navigate,
  setModal,
  animals,
  donationStats,
  notices,
  onPublishNotice,
}) {
  const [noticeText, setNoticeText] = useState("");
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const upcomingEvents = events.filter((event) => event.date >= todayIso);
  const nextEvent = upcomingEvents[0];

  async function publish() {
    if (!noticeText.trim()) return;
    const saved = await onPublishNotice(noticeText);
    if (saved) setNoticeText("");
  }

  return (
    <div className="dashboard-page">
      <section className="summary-cards">
        <StatCard
          icon="♡"
          label="Animals in care"
          value={String(animals.length)}
          note={`${animals.filter((animal) => animal.type === "Dog").length} dogs · ${animals.filter((animal) => animal.type === "Cat").length} cats`}
          accent="rose"
        />
        <StatCard
          icon="⌂"
          label="Available for adoption"
          value={String(
            animals.filter((animal) => animal.status === "Available").length,
          )}
          note="Find them a loving home"
          accent="green"
        />
        <StatCard
          icon="R"
          label="Donations this month"
          value={formatRand(donationStats?.monthTotal)}
          note={`${donationStats?.monthCount ?? 0} completed this month`}
          accent="gold"
        />
        <StatCard
          icon="▦"
          label="Upcoming events"
          value={String(upcomingEvents.length)}
          note={nextEvent ? `Next: ${nextEvent.title}` : "Nothing scheduled"}
          accent="blue"
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel dashboard-calendar">
          <PanelHeading
            eyebrow="YOUR SCHEDULE"
            title={today.toLocaleDateString("en-ZA", {
              month: "long",
              year: "numeric",
            })}
            action="View calendar"
            onAction={() => navigate("/staff/calendar")}
          />
          <MiniCalendar
            events={events}
            month={today.getMonth()}
            year={today.getFullYear()}
          />
        </section>
        <section className="panel dashboard-events">
          <PanelHeading
            eyebrow="WHAT’S COMING UP"
            title="Upcoming events"
            action="See all"
            onAction={() => navigate("/staff/calendar")}
          />
          <div className="upcoming-list">
            {upcomingEvents.slice(0, 3).map((event) => (
              <EventRow
                key={event.id}
                date={event.date}
                title={event.title}
                detail={`${event.time || "Time not set"} · ${event.notes || "Shelter"}`}
                kind={event.kind}
              />
            ))}
            {upcomingEvents.length === 0 && <p>No upcoming events yet.</p>}
          </div>
          <button
            className="staff-button outline-button event-add-button"
            onClick={() => setModal("add-event")}
          >
            ＋ Add event
          </button>
        </section>
        <section className="panel dashboard-donations">
          <PanelHeading
            eyebrow="GIVING BACK"
            title="Donation overview"
            action="View donations"
            onAction={() => navigate("/staff/donations")}
          />
          <div className="donation-total">
            <div>
              <strong>{formatRand(donationStats?.monthTotal)}</strong>
              <small>raised this month</small>
            </div>
            <span className="change-pill">
              {donationStats?.monthCount ?? 0} gifts
            </span>
          </div>
          <DonationChart monthly={donationStats?.monthly ?? []} />
          <button
            className="staff-button outline-button wide-button"
            onClick={() => navigate("/staff/donations")}
          >
            Explore donations <span>→</span>
          </button>
        </section>
        <section className="panel dashboard-notice">
          <PanelHeading eyebrow="FROM THE TEAM" title="Write a notice" />
          <p>Share a quick update with the rest of the shelter team.</p>
          <textarea
            value={noticeText}
            onChange={(event) => setNoticeText(event.target.value)}
            aria-label="Write a team notice"
            placeholder="Type your message here..."
            rows="3"
          />
          <div className="notice-actions">
            <span>Only staff can see this.</span>
            <button
              className="staff-button primary-button"
              onClick={publish}
              disabled={!noticeText.trim()}
            >
              ＋ Publish notice
            </button>
          </div>
          {notices.length > 0 && (
            <div className="team-notice-list">
              <strong>Latest team notices</strong>
              {notices.slice(0, 3).map((item) => (
                <p key={item.id}>
                  {item.message} <small>— {item.author}</small>
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, note, accent }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${accent}`}>{icon}</span>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        <span className="stat-note">{note}</span>
      </div>
    </article>
  );
}

function PanelHeading({ eyebrow, title, action, onAction }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="panel-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="panel-action" onClick={onAction}>
          {action} <span>→</span>
        </button>
      )}
    </div>
  );
}

function MiniCalendar({ events, month, year }) {
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <div className="mini-calendar">
      <div className="calendar-week">
        {dayNames.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {cells.map((day, index) => {
          const date = day
            ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            : "";
          const event = day && events.find((item) => item.date === date);
          return (
            <div
              key={index}
              className={`calendar-day ${day ? "" : "empty"} ${date === todayIso ? "today" : ""}`}
            >
              {day && (
                <>
                  <span>{day}</span>
                  {event && (
                    <i
                      className={`event-dot ${event.kind}`}
                      title={event.title}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({ date, title, detail, kind }) {
  const day = date ? Number(date.slice(-2)) : "";
  const month = date
    ? new Date(`${date}T12:00:00`)
        .toLocaleDateString("en", { month: "short" })
        .toUpperCase()
    : "";
  return (
    <article className="event-row">
      <div className={`event-date ${kind}`}>
        <strong>{String(day).padStart(2, "0")}</strong>
        <span>{month}</span>
      </div>
      <div className="event-info">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <span className={`event-kind ${kind}`}>
        {kind === "medical"
          ? "Medical"
          : kind === "supply"
            ? "Delivery"
            : "Event"}
      </span>
    </article>
  );
}

function DonationChart({ monthly }) {
  const values = monthly.map((item) => item.total);
  const maximum = Math.max(1, ...values);
  return (
    <>
      <div
        className="donation-chart"
        aria-label="Completed donation totals by month"
      >
        {monthly.map((item) => (
          <div
            key={item.month}
            className="chart-column"
            title={`${item.month}: ${formatRand(item.total)}`}
          >
            <i
              style={{
                height: `${Math.max(4, (item.total / maximum) * 100)}%`,
              }}
              className={item === monthly.at(-1) ? "current" : ""}
            />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {monthly.map((item) => (
          <span key={item.month}>
            {new Date(`${item.month}-01T12:00:00`).toLocaleDateString("en", {
              month: "short",
            })}
          </span>
        ))}
      </div>
      {!monthly.length && <p>No completed donation data yet.</p>}
    </>
  );
}

function AnimalsPage({ animals, canManage, onAdd, onSelect, onDelete }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const visibleAnimals = animals.filter((animal) => {
    const matchesType = filter === "All" || animal.type === filter;
    const matchesSearch = `${animal.name} ${animal.breed}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });
  return (
    <div className="section-page">
      <div className="section-page-heading">
        <div>
          <span className="panel-eyebrow">YOUR SHELTER ROSTER</span>
          <h2>Meet the animals</h2>
          <p>
            {canManage
              ? "Manage profiles and keep their details up to date."
              : "Meet the animals currently looking for a home."}
          </p>
        </div>
        {canManage && (
          <button className="staff-button primary-button" onClick={onAdd}>
            ＋ Add an animal
          </button>
        )}
      </div>
      <div className="animal-toolbar">
        <div className="animal-filters">
          {[
            ["All", "All animals", animals.length],
            [
              "Dog",
              "Dogs",
              animals.filter((item) => item.type === "Dog").length,
            ],
            [
              "Cat",
              "Cats",
              animals.filter((item) => item.type === "Cat").length,
            ],
          ].map(([key, label, count]) => (
            <button
              key={key}
              className={`filter-chip ${filter === key ? "selected" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        <label className="animal-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search animals..."
          />
        </label>
      </div>
      <div className="animal-grid">
        {visibleAnimals.map((animal) => (
          <article className="animal-card" key={animal.id}>
            <button
              className="animal-image-button"
              onClick={() => onSelect(animal)}
              aria-label={`View ${animal.name}`}
            >
              <img src={animal.image} alt={animal.name} />
              <span className={`animal-status ${animal.status.toLowerCase()}`}>
                {animal.status}
              </span>
            </button>
            <div className="animal-card-copy">
              <div className="animal-card-title">
                <div>
                  <h3>{animal.name}</h3>
                  <span>{animal.breed}</span>
                </div>
                {onDelete && (
                  <button
                    className="card-more"
                    onClick={() => onDelete(animal)}
                    aria-label={`Delete ${animal.name}`}
                  >
                    ···
                  </button>
                )}
              </div>
              <div className="animal-card-meta">
                <span>{animal.type}</span>
                <span>·</span>
                <span>{animal.age}</span>
                <button onClick={() => onSelect(animal)}>View profile →</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {visibleAnimals.length === 0 && (
        <div className="empty-animals">No animals match your search.</div>
      )}
    </div>
  );
}

function AnimalProfile({
  animal,
  canManage = false,
  onClose,
  onEdit,
  onMarkAdopted,
}) {
  return (
    <div className="animal-profile-modal">
      <button
        className="modal-close profile-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div className="profile-modal-copy">
        <span className="profile-tag">
          {animal.status === "Available"
            ? "LOOKING FOR A HOME"
            : animal.status.toUpperCase()}
        </span>
        <h2>
          Meet
          <br />
          <em>{animal.name}</em>
        </h2>
        <p className="profile-breed">{animal.breed || "Breed not specified"}</p>
        <dl className="profile-details">
          <div>
            <dt>Type</dt>
            <dd>{animal.type}</dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{animal.age || "Age not specified"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{animal.status}</dd>
          </div>
        </dl>
        <p className="profile-description">
          {animal.description || "More about this animal will be added soon."}
        </p>
        {canManage && (
          <div className="profile-staff-actions">
            <button className="staff-button outline-button" onClick={onEdit}>
              Edit details
            </button>
            <button
              className="staff-button primary-button"
              onClick={onMarkAdopted}
            >
              {animal.status === "Available"
                ? "Mark as adopted"
                : "Mark as available"}
            </button>
          </div>
        )}
        {!canManage && animal.status === "Available" && (
          <a
            className="staff-button primary-button profile-contact"
            href={`mailto:${shelterEmail}?subject=${encodeURIComponent(`Adoption enquiry: ${animal.name}`)}&body=${encodeURIComponent(`Hello Pawsitive,\n\nI would like to ask about adopting ${animal.name}.`)}`}
          >
            Ask about adopting
          </a>
        )}
      </div>
      <img src={animal.image} alt={animal.name} />
    </div>
  );
}

function DonationsPage({ onError }) {
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);

  useEffect(() => {
    let active = true;
    api(`/donations?page=${page}`)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((error) => {
        if (active) onError(`Could not load donations: ${error.message}`);
      });
    return () => {
      active = false;
    };
  }, [page, onError]);

  const stats = report?.stats;
  const pageCount = Math.max(
    1,
    Math.ceil((report?.total ?? 0) / (report?.pageSize ?? 7)),
  );
  const start = report?.total ? (page - 1) * report.pageSize + 1 : 0;
  const end = Math.min(page * (report?.pageSize ?? 7), report?.total ?? 0);

  return (
    <div className="section-page">
      <div className="section-page-heading">
        <div>
          <span className="panel-eyebrow">EVERY GIFT MAKES A DIFFERENCE</span>
          <h2>Giving overview</h2>
          <p>
            Track completed contributions and see how the community is helping.
          </p>
        </div>
        <a
          className="staff-button outline-button"
          href={apiUrl("/donations/export")}
        >
          ⇩ Export report
        </a>
      </div>
      <div className="donation-stat-grid">
        <StatCard
          icon="R"
          label="Total this month"
          value={formatRand(stats?.monthTotal)}
          note="Completed this month"
          accent="rose"
        />
        <StatCard
          icon="♡"
          label="Donations received"
          value={String(stats?.monthCount ?? 0)}
          note="This month"
          accent="green"
        />
        <StatCard
          icon="↗"
          label="Average donation"
          value={formatRand(stats?.averageAmount)}
          note="Across all donations"
          accent="gold"
        />
      </div>
      <section className="panel donation-table-panel">
        <PanelHeading eyebrow="LATEST SUPPORT" title="Recent donations" />
        <div className="table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>AMOUNT</th>
                <th>DONOR</th>
                <th>TYPE</th>
                <th>PAYMENT METHOD</th>
                <th>DATE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {(report?.donations ?? []).map((donation) => (
                <tr key={donation.id}>
                  <td className="amount-cell" data-label="Amount">
                    {formatRand(donation.amount)}
                  </td>
                  <td data-label="Donor">
                    <span className="donor-avatar">
                      {donation.donorName === "Anonymous"
                        ? "♡"
                        : donation.donorName
                            .split(" ")
                            .map((name) => name[0])
                            .join("")}
                    </span>
                    {donation.donorName}
                  </td>
                  <td data-label="Type">
                    <span
                      className={`donation-type type-${donation.category.toLowerCase()}`}
                    >
                      {donation.category}
                    </span>
                  </td>
                  <td data-label="Payment method">{donation.paymentMethod}</td>
                  <td data-label="Date">{donation.date}</td>
                  <td data-label="Status">
                    <span
                      className={`status-label ${donation.status.toLowerCase()}`}
                    >
                      {donation.status}
                    </span>
                  </td>
                </tr>
              ))}
              {report?.donations.length === 0 && (
                <tr>
                  <td className="donation-empty" colSpan="6">
                    <span className="donation-empty-icon" aria-hidden="true">
                      ♡
                    </span>
                    <strong>No donations recorded yet</strong>
                    <span>Completed PayFast donations will appear here.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            Showing {start}–{end} of {report?.total ?? 0} donations
          </span>
          <div>
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              ←
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1)
              .filter(
                (number) =>
                  Math.abs(number - page) <= 1 ||
                  number === 1 ||
                  number === pageCount,
              )
              .map((number) => (
                <button
                  key={number}
                  className={page === number ? "page-number" : ""}
                  onClick={() => setPage(number)}
                  aria-current={page === number ? "page" : undefined}
                >
                  {number}
                </button>
              ))}
            <button
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CalendarPage({
  events,
  availability,
  siteVisits,
  onAdd,
  onAvailability,
  onDeleteEvent,
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const todayIso = now.toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const monthName = new Date(year, month).toLocaleString("en", {
    month: "long",
  });
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const numberOfDays = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: numberOfDays }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  function moveMonth(direction) {
    const date = new Date(year, month + direction, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  }
  const selectedEvents = events.filter((event) => event.date === selectedDate);
  const selectedVisits = siteVisits.filter(
    (visit) => visit.date === selectedDate,
  );
  const selectedDay = Number(selectedDate.slice(-2));
  return (
    <div className="section-page calendar-page">
      <div className="section-page-heading">
        <div>
          <span className="panel-eyebrow">KEEP EVERYONE IN THE LOOP</span>
          <h2>Shelter calendar</h2>
          <p>Plan appointments, deliveries, and shelter events.</p>
        </div>
        <div className="calendar-page-actions">
          <button
            className="staff-button outline-button"
            onClick={onAvailability}
          >
            Manage availability
          </button>
          <button className="staff-button primary-button" onClick={onAdd}>
            ＋ New event
          </button>
        </div>
      </div>
      <div className="full-calendar-layout">
        <section className="panel full-calendar-panel">
          <div className="month-controls">
            <div>
              <button onClick={() => moveMonth(-1)} aria-label="Previous month">
                ←
              </button>
              <button onClick={() => moveMonth(1)} aria-label="Next month">
                →
              </button>
              <h2>
                {monthName} <span>{year}</span>
              </h2>
            </div>
            <button
              className="today-button"
              onClick={() => {
                const today = new Date();
                setMonth(today.getMonth());
                setYear(today.getFullYear());
                setSelectedDate(today.toISOString().slice(0, 10));
              }}
            >
              Today
            </button>
          </div>
          <div className="full-calendar">
            <div className="full-calendar-week">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="full-calendar-days">
              {cells.map((day, index) => {
                const date = day
                  ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  : "";
                const dayEvents = events.filter((event) => event.date === date);
                const dayVisits = siteVisits.filter(
                  (visit) => visit.date === date,
                );
                return (
                  <button
                    key={index}
                    className={`full-calendar-day ${day ? "" : "empty"} ${date === selectedDate ? "selected" : ""} ${date === todayIso ? "today" : ""}`}
                    onClick={() => {
                      if (day) setSelectedDate(date);
                    }}
                    disabled={!day}
                  >
                    <span className="full-day-number">{day}</span>
                    {dayEvents.map((event) => (
                      <span
                        key={event.id}
                        className={`calendar-event-pill ${event.kind}`}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayVisits.map((visit) => (
                      <span
                        key={`visit-${visit.id}`}
                        className="calendar-event-pill site-visit-pill"
                      >
                        Site visit · {visit.name}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <aside className="panel day-agenda">
          <span className="panel-eyebrow">YOUR DAY</span>
          <h2>
            {monthName.slice(0, 3)} {selectedDay}
          </h2>
          <p className="agenda-date">
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en", {
              weekday: "long",
              year: "numeric",
            })}
          </p>
          <div className="agenda-summary">
            <span>{selectedEvents.length + selectedVisits.length}</span> items
            scheduled
          </div>
          <div className="availability-summary">
            <strong>Team availability</strong>
            {availability.filter((slot) => slot.date === selectedDate)
              .length ? (
              availability
                .filter((slot) => slot.date === selectedDate)
                .map((slot) => (
                  <span key={slot.date}>Available from {slot.time}</span>
                ))
            ) : (
              <span>No availability saved for this day.</span>
            )}
          </div>
          {selectedEvents.length
            ? selectedEvents.map((event) => (
                <div className="event-agenda-item" key={event.id}>
                  <EventRow
                    date={event.date}
                    title={event.title}
                    detail={`${event.time || "Time not set"} · ${event.notes || "Shelter"}`}
                    kind={event.kind}
                  />
                  <button
                    className="event-delete-button"
                    onClick={() => onDeleteEvent(event.id)}
                    aria-label={`Delete ${event.title}`}
                  >
                    Delete event
                  </button>
                </div>
              ))
            : null}
          {selectedVisits.map((visit) => (
            <div
              className="event-agenda-item site-visit-agenda"
              key={`visit-${visit.id}`}
            >
              <EventRow
                date={visit.date}
                title={`Site visit · ${visit.name}`}
                detail={`${visit.time} · ${visit.email}`}
                kind="event"
              />
            </div>
          ))}
          {!selectedEvents.length && !selectedVisits.length && (
            <div className="empty-agenda">
              <span>☼</span>
              <strong>Nothing planned yet</strong>
              <p>
                Enjoy a little breathing room. Add an event whenever you need
                to.
              </p>
            </div>
          )}
          <button
            className="staff-button primary-button agenda-add"
            onClick={onAdd}
          >
            ＋ Add an event
          </button>
        </aside>
      </div>
    </div>
  );
}

function AvailabilityModal({ availability, onClose, onSave }) {
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("09:00");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toISOString().slice(11, 16);
  const isFutureDateTime =
    date > today || (date === today && time > currentTime);
  return (
    <div className="modal-content availability-content">
      <ModalHeading
        title="Manage availability"
        subtitle="Set a time that works for your team."
        onClose={onClose}
      />
      <div className="availability-date">
        <label>
          Select a date
          <input
            type="date"
            value={date}
            min={today}
            onChange={(event) => {
              const nextDate = event.target.value;
              setDate(nextDate);
              const existing = availability.find(
                (item) => item.date === nextDate,
              );
              if (existing) setTime(existing.time);
            }}
          />
        </label>
        <label>
          Available from
          <input
            type="time"
            value={time}
            min={date === today ? currentTime : undefined}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
      </div>
      {!isFutureDateTime && (
        <p className="availability-validation" role="status">
          Choose a future date and time to publish availability.
        </p>
      )}
      {availability.length > 0 && (
        <div className="availability-saved">
          <span>SAVED AVAILABILITY</span>
          {availability.map((slot) => (
            <button
              type="button"
              key={slot.date}
              onClick={() => {
                setDate(slot.date);
                setTime(slot.time);
              }}
            >
              {slot.date} · {slot.time}
            </button>
          ))}
        </div>
      )}
      <div className="availability-slots">
        <span>QUICK SLOTS</span>
        <div>
          {["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"].map(
            (slot) => (
              <button
                key={slot}
                className={time === slot ? "selected" : ""}
                onClick={() => setTime(slot)}
              >
                {slot}
              </button>
            ),
          )}
        </div>
      </div>
      <button
        className="staff-button primary-button form-submit"
        disabled={!isFutureDateTime}
        onClick={() => onSave(date, time)}
      >
        Save availability
      </button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="staff-modal" role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  );
}

function ModalHeading({ title, subtitle, onClose }) {
  return (
    <div className="modal-heading">
      <div>
        <span className="panel-eyebrow">PAWSITIVE STAFF PORTAL</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <button className="modal-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function AuthPage({ mode, onNavigate, onSubmit }) {
  const signup = mode === "signup";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (signup && password !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await onSubmit({
        name: `${String(form.get("firstName") || "").trim()} ${String(form.get("surname") || "").trim()}`.trim(),
        email: String(form.get("email") || "").trim(),
        password,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <a
        href="/"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("/");
        }}
        className="auth-brand"
      >
        <img src={logo} alt="Pawsitive" />
      </a>
      <section className="auth-card">
        <div className="auth-card-title">
          <span className="auth-user-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c.7-3.7 3.3-5.5 7.5-5.5s6.8 1.8 7.5 5.5" />
            </svg>
          </span>
          <div>
            <span className="auth-eyebrow">PAWSITIVE ANIMAL SHELTER</span>
            <h1>{signup ? "Create your account" : "Welcome back"}</h1>
            <p>
              {signup
                ? "Create an account to explore animals and adoption profiles."
                : "Sign in with your account to continue."}
            </p>
          </div>
        </div>
        <form onSubmit={submit}>
          {signup && (
            <div className="form-columns">
              <label>
                First name
                <input
                  name="firstName"
                  placeholder="First name"
                  required
                  maxLength={60}
                />
              </label>
              <label>
                Surname
                <input
                  name="surname"
                  placeholder="Surname"
                  required
                  maxLength={60}
                />
              </label>
            </div>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              placeholder="Email address"
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={signup ? 10 : undefined}
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </label>
          {signup && (
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm password"
                required
                autoComplete="new-password"
              />
            </label>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="staff-button primary-button auth-submit"
            disabled={pending}
          >
            {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="auth-switch"
          type="button"
          onClick={() => onNavigate(signup ? "/signin" : "/signup")}
        >
          {signup ? "Already have an account? Log in" : "Create a new account"}
        </button>
      </section>
    </main>
  );
}

function DonationCheckoutPage({ onNavigate, user = null, embedded = false }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("100");

  async function startCheckout(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const checkout = await api("/donations/checkout", {
        method: "POST",
        body: JSON.stringify({
          amount: form.get("amount"),
          name: form.get("name"),
          email: form.get("email"),
          category: form.get("category"),
        }),
      });
      const paymentForm = document.createElement("form");
      paymentForm.method = "POST";
      paymentForm.action = checkout.url;
      Object.entries(checkout.fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        paymentForm.append(input);
      });
      document.body.append(paymentForm);
      paymentForm.submit();
    } catch (checkoutError) {
      setError(checkoutError.message);
      setPending(false);
    }
  }

  const cancelled = new URLSearchParams(window.location.search).has(
    "cancelled",
  );

  return (
    <main className={embedded ? "user-donate-content" : "auth-page"}>
      {!embedded && (
        <a
          className="auth-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/");
          }}
        >
          <img src={logo} alt="Pawsitive" />
        </a>
      )}
      <section
        className={`auth-card donation-checkout-card ${embedded ? "embedded-donation-card" : ""}`}
      >
        <span className="auth-eyebrow">MAKE A DIFFERENCE</span>
        <h1>Support the animals</h1>
        <p>Your secure donation will be processed by PayFast.</p>
        {cancelled && (
          <p role="status">
            The payment was cancelled. No donation was charged.
          </p>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}{" "}
            <a
              href={`mailto:${shelterEmail}?subject=${encodeURIComponent("Donation enquiry")}`}
            >
              Contact the shelter about another way to donate.
            </a>
          </p>
        )}
        <form onSubmit={startCheckout}>
          <label>
            Amount (ZAR)
            <input
              name="amount"
              type="number"
              min="10"
              max="100000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label>
            What would you like to support?
            <select name="category">
              <option>General</option>
              <option>Food</option>
              <option>Medical</option>
            </select>
          </label>
          <label>
            Your name (optional)
            <input
              name="name"
              maxLength="160"
              autoComplete="name"
              defaultValue={user?.name ?? ""}
            />
          </label>
          <label>
            Email for payment updates
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={user?.email ?? ""}
            />
          </label>
          <button
            className="staff-button primary-button auth-submit"
            disabled={pending}
          >
            {pending
              ? "Connecting to PayFast…"
              : `Donate ${formatRand(amount)}`}
          </button>
        </form>
        <button
          className="auth-switch"
          type="button"
          onClick={() => onNavigate(embedded ? "/user/home" : "/")}
        >
          {embedded ? "Return to your home" : "Return to Pawsitive"}
        </button>
      </section>
    </main>
  );
}

function DonationCompletePage({ onNavigate, embedded = false }) {
  return (
    <main className={embedded ? "user-donate-content" : "auth-page"}>
      <section
        className={`auth-card donation-checkout-card ${embedded ? "embedded-donation-card" : ""}`}
        role="status"
      >
        <span className="auth-eyebrow">PAWSITIVE ANIMAL SHELTER</span>
        <h1>Thank you for your support</h1>
        <p>
          PayFast is confirming the payment. The shelter donation record will
          update after confirmation.
        </p>
        <button
          className="staff-button primary-button auth-submit"
          onClick={() => onNavigate(embedded ? "/user/home" : "/")}
        >
          {embedded ? "Return to your home" : "Return to Pawsitive"}
        </button>
      </section>
    </main>
  );
}

function PublicPage({
  animals,
  userView,
  currentUser,
  onNavigate,
  onSignOut,
  onSelect,
  loadError,
  onRetry,
}) {
  const [facilityPhoto, setFacilityPhoto] = useState(0);
  const staffGroups = [
    { name: "Directors", count: 3 },
    { name: "Staff", count: 4 },
    { name: "Committee members", count: 5 },
  ];

  function showFacilityPhoto(direction) {
    setFacilityPhoto((current) => (current + direction + 4) % 4);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a
          className="wordmark nav-logo"
          href="#top"
          aria-label="Pawsitive home"
        >
          <img src={logo} alt="Pawsitive Animal Shelter" />
        </a>
        <div className="header-actions">
          {userView && (
            <a
              className="button button-secondary"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                onNavigate("/");
              }}
            >
              Home
            </a>
          )}
          <a
            className="button button-secondary"
            href="/donate"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/donate");
            }}
          >
            Donate
          </a>
          {currentUser ? (
            <>
              {currentUser.role === "staff" && (
                <a
                  className="button button-secondary"
                  href="/staff/dashboard"
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate("/staff/dashboard");
                  }}
                >
                  Staff portal
                </a>
              )}
              {currentUser.role !== "staff" && (
                <a
                  className="button button-secondary"
                  href="/user/profile"
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate("/user/profile");
                  }}
                >
                  My profile
                </a>
              )}
              <button className="button button-primary" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <a
              className="button button-primary"
              href="/signin"
              onClick={(event) => {
                event.preventDefault();
                onNavigate("/signin");
              }}
            >
              Sign in
            </a>
          )}
        </div>
      </header>
      <main id="top">
        <section className="hero section-frame" id="pets">
          <h1 className="hero-title">Our pets</h1>
          <div className="hero-gallery">
            <div className="pet-photo-placeholder">
              <img
                className="pet-photo-image"
                src={heroDog}
                alt="Dog cared for at Pawsitive"
              />
            </div>
            <div className="pet-photo-placeholder">
              <img
                className="pet-photo-image"
                src={heroCat}
                alt="Cat cared for at Pawsitive"
              />
            </div>
            <a
              className="hero-more"
              href={userView ? "#adoptable-pets" : "/adopt"}
              onClick={
                userView
                  ? undefined
                  : (event) => {
                      event.preventDefault();
                      onNavigate("/adopt");
                    }
              }
            >
              {userView ? "Meet the animals" : "Browse adoptable pets"}
            </a>
          </div>
        </section>
        {loadError && (
          <div className="public-load-error" role="alert">
            <span>{loadError}</span>
            <button onClick={onRetry}>Retry</button>
          </div>
        )}
        {userView && (
          <section
            className="public-animal-section section-frame"
            id="adoptable-pets"
          >
            <div className="public-animal-heading">
              <span className="panel-eyebrow">MEET YOUR NEW BEST FRIEND</span>
              <h2>Available for adoption</h2>
              <p>Explore profiles shared by our shelter team.</p>
            </div>
            <div className="public-animal-grid">
              {animals
                .filter((animal) => animal.status === "Available")
                .map((animal) => (
                  <article className="public-animal-card" key={animal.id}>
                    <button
                      className="public-animal-image"
                      type="button"
                      onClick={() => onSelect(animal)}
                      aria-label={`View ${animal.name}'s profile`}
                    >
                      <img src={animal.image} alt={animal.name} />
                    </button>
                    <div className="public-animal-copy">
                      <span className="public-animal-type">
                        {animal.type} · {animal.age || "Age not specified"}
                      </span>
                      <h3>{animal.name}</h3>
                      <p>{animal.breed || "Breed not specified"}</p>
                      <button
                        className="public-animal-link"
                        type="button"
                        onClick={() => onSelect(animal)}
                      >
                        View profile <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </article>
                ))}
              {animals.filter((animal) => animal.status === "Available")
                .length === 0 &&
                !loadError && (
                  <p>No animals are currently listed for adoption.</p>
                )}
            </div>
          </section>
        )}
        <section className="about-section section-frame" id="about">
          <div className="sectionInner" id="aboutInner">
            <div className="section-copy">
              <h2>About us</h2>
              <p>
                We care for abandoned, neglected, and forgotten animals. Our
                shelter has 19 enclosures and currently provides a home for 42
                dogs and 8 cats.
              </p>
              <p>
                Our vision is to support the communities around us, including
                Diepsloot and Olivenhoutbosch. We are committed to making a
                difference, one animal at a time.
              </p>
            </div>
          </div>
        </section>
        <section className="facility-section section-frame" id="facility">
          <div className="facility-heading">
            <h2>Our facility</h2>
            <p>Scroll through photos of our facility</p>
          </div>
          <div className="facility-carousel" aria-label="Facility photos">
            <button
              className="facility-carousel-button previous"
              type="button"
              onClick={() => showFacilityPhoto(-1)}
              aria-label="Show previous facility photo"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <img
              className="facility-photo"
              src={facilityPhotos[facilityPhoto]}
              alt={`Facility photo ${facilityPhoto + 1}`}
            />
            <button
              className="facility-carousel-button next"
              type="button"
              onClick={() => showFacilityPhoto(1)}
              aria-label="Show next facility photo"
            >
              <span aria-hidden="true">›</span>
            </button>
            <div
              className="facility-carousel-dots"
              aria-label={`Photo ${facilityPhoto + 1} of 4`}
            >
              {Array.from({ length: 4 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={facilityPhoto === index ? "active" : ""}
                  onClick={() => setFacilityPhoto(index)}
                  aria-label={`Show facility photo ${index + 1}`}
                  aria-current={facilityPhoto === index ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        </section>
        <section className="people-section section-frame" id="people">
          <div className="people-heading">
            <h2>Our people</h2>
          </div>
          <div className="team-list">
            {staffGroups.map((group) => (
              <section
                className="team-group"
                key={group.name}
                aria-label={group.name}
              >
                <h3>{group.name}</h3>
                <div className="team-photos">
                  {(group.name === "Directors"
                    ? directorPhotos
                    : group.name === "Staff"
                      ? staffPhotos
                      : committeePhotos
                  ).map((photo, index) => (
                    <img
                      className="staff-photo"
                      key={photo}
                      src={photo}
                      alt={`${group.name === "Directors" ? "Director" : group.name === "Staff" ? "Staff member" : "Committee member"} ${index + 1}`}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer" id="contact">
        <a className="footer-brand" href="#top" aria-label="Pawsitive home">
          <img src={logo} alt="Pawsitive Animal Shelter" />
        </a>
        <address className="footer-contact">
          <svg
            className="footer-contact-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="10" r="2.25" fill="currentColor" />
          </svg>
          143 Pretorius Street, Laezonia AH
        </address>
        <a className="footer-contact" href={`mailto:${shelterEmail}`}>
          <svg
            className="footer-contact-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m4 7 8 6 8-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          pawsitivesa@gmail.com
        </a>
        {currentUser ? (
          currentUser.role === "staff" ? (
            <a
              className="footer-signin button button-primary"
              href="/signin"
              onClick={(event) => {
                event.preventDefault();
                onNavigate("/signin");
              }}
            >
              Sign in <span aria-hidden="true"></span>
            </a>
          ) : (
            <button
              className="footer-signin button button-primary"
              onClick={onSignOut}
            >
              Sign out <span aria-hidden="true"></span>
            </button>
          )
        ) : (
          <a
            className="footer-signin button button-primary"
            href="/signin"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/signin");
            }}
          >
            Sign in <span aria-hidden="true"></span>
          </a>
        )}
      </footer>
    </div>
  );
}

function pageTitle(page) {
  return (
    { animals: "Animals", donations: "Donations", calendar: "Calendar" }[
      page
    ] || "Dashboard"
  );
}

export default App;
