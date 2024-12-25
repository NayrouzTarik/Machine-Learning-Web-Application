import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import accuracy_score, mean_squared_error, silhouette_score, homogeneity_score, completeness_score, v_measure_score
from sklearn.metrics import accuracy_score, mean_squared_error
from pre_traitement.clean import detect_target_column


# Fonction pour encoder les données catégorielles
def encode_data(data):
    for column in data.select_dtypes(include=['object']).columns:
        le = LabelEncoder()
        data[column] = le.fit_transform(data[column])
    return data

# Fonction pour appliquer KNN et évaluer les résultats
def knn_model(X_train, y_train, X_test, y_test, problem_type, n_neighbors=5):
    if problem_type == "classification":
        # Appliquer KNN pour classification
        model = KNeighborsClassifier(n_neighbors=n_neighbors)
        model.fit(X_train, y_train)
        
        # Prédictions
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        
        # Évaluation de la classification
        train_accuracy = accuracy_score(y_train, y_pred_train)
        test_accuracy = accuracy_score(y_test, y_pred_test)
        
        print(f"Accuracy (Train) : {train_accuracy:.2f}")
        print(f"Accuracy (Test) : {test_accuracy:.2f}")
        return model, train_accuracy, test_accuracy
    
    elif problem_type == "regression":
        # Appliquer KNN pour régression
        model = KNeighborsRegressor(n_neighbors=n_neighbors)
        model.fit(X_train, y_train)
        
        # Prédictions
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        
        # Évaluation de la régression
        train_mse = mean_squared_error(y_train, y_pred_train)
        test_mse = mean_squared_error(y_test, y_pred_test)
        
        print(f"Mean Squared Error (Train) : {train_mse:.2f}")
        print(f"Mean Squared Error (Test) : {test_mse:.2f}")
        return model, train_mse, test_mse
    
    else:
        print("Type de problème inconnu, aucun modèle entraîné.")
        return None, None

# Fonction principale pour nettoyer et prétraiter les données
def preprocess_data(data):
    # Nettoyage des données (encodage des valeurs catégorielles)
    data = encode_data(data)

    # Détecter la colonne cible et le type de problème
    target_column, problem_type = detect_target_column(data)
    
    if target_column:
        X = data.drop(columns=[target_column])
        y = data[target_column]
    else:
        X = data
        y = None

    return X, y, target_column, problem_type

###############################################################################
def KNN(data, n_neighbors=5):
    # Prétraiter les données
    X, y, target_column, problem_type = preprocess_data(data)

    if X is None or y is None or problem_type is None:
        print("Les données ne sont pas adaptées pour le modèle KNN.")
        return

    print(f"Colonne cible détectée : {target_column}")
    print(f"Type de problème détecté : {problem_type}")

  
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    print("Exécution du modèle KNN...")
    model, train_metric, test_metric = knn_model(X_train, y_train, X_test, y_test, problem_type, n_neighbors)

    return model, train_metric, test_metric